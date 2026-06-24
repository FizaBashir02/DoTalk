/// <reference types="vite/client" />
import { io, Socket } from 'socket.io-client';

// Global diagnostics tracking state
export interface DiagnosticResult {
  apiUrl: string;
  apiUrlSource: string;
  isUrlValid: boolean;
  isLocalhost: boolean;
  isCleartextBlocked: boolean;
  isOnline: boolean;
  externalInternetOk: boolean | null;
  backendReachable: boolean;
  backendHttpStatus: number | null;
  socketReachable: boolean;
  socketError: string | null;
  errorClassification: 'OK' | 'INVALID_URL' | 'LOCAL_OFFLINE' | 'CLEARTEXT_BLOCKED' | 'TIMEOUT' | 'BACKEND_OFFLINE' | 'SSL_OR_DNS_ERROR' | 'UNKNOWN';
  errorMessage: string | null;
  timestamp: string;
}

let latestDiagnostics: DiagnosticResult = {
  apiUrl: '',
  apiUrlSource: 'Uninitialized',
  isUrlValid: false,
  isLocalhost: false,
  isCleartextBlocked: false,
  isOnline: false,
  externalInternetOk: null,
  backendReachable: false,
  backendHttpStatus: null,
  socketReachable: false,
  socketError: null,
  errorClassification: 'UNKNOWN',
  errorMessage: 'Diagnostics have not run yet.',
  timestamp: new Date().toISOString(),
};

// Centralized Single Source of Truth for API URL Resolution
export function getBackendUrl(): string {
  // Check for any active user-defined override from the diagnostics console
  if (typeof window !== 'undefined' && window.localStorage) {
    const override = window.localStorage.getItem('dotalk_custom_api_url');
    if (override && override.trim() !== '') {
      const trimmed = override.trim();
      return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
    }
  }

  // Read environment variables loaded by Vite (either at compile time or via define plugin)
  const envUrl = 
    import.meta.env.VITE_API_URL || 
    import.meta.env.VITE_BACKEND_URL || 
    import.meta.env.VITE_API_BASE_URL ||
    (typeof process !== 'undefined' && process.env?.BACKEND_URL) ||
    (typeof process !== 'undefined' && process.env?.VITE_API_URL);
    
  if (envUrl && typeof envUrl === 'string' && envUrl.trim() !== '') {
    const trimmed = envUrl.trim();
    return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
  }

  // Fallback to window location origin in web browser preview mode (not inside Capacitor app)
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    const origin = window.location.origin;
    const isCapacitorOrLocal = 
      origin.includes('localhost') || 
      origin.includes('127.0.0.1') || 
      origin.includes('10.0.2.2') || 
      origin.startsWith('capacitor:') || 
      origin.startsWith('file:');
      
    if (!isCapacitorOrLocal) {
      return origin;
    }
  }

  return '';
}

// Socket URL Resolution (HTTPS -> WSS, HTTP -> WS)
export function getSocketUrl(): string {
  // Check for any active user-defined override from the diagnostics console
  if (typeof window !== 'undefined' && window.localStorage) {
    const override = window.localStorage.getItem('dotalk_custom_api_url');
    if (override && override.trim() !== '') {
      const trimmed = override.trim();
      const wsOverride = trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
      if (wsOverride.startsWith('https://')) {
        return wsOverride.replace('https://', 'wss://');
      } else if (wsOverride.startsWith('http://')) {
        return wsOverride.replace('http://', 'ws://');
      }
      return wsOverride;
    }
  }

  const envWs = 
    import.meta.env.VITE_WS_URL || 
    import.meta.env.VITE_SOCKET_URL ||
    import.meta.env.WS_URL ||
    (typeof process !== 'undefined' && process.env?.WS_URL) ||
    (typeof process !== 'undefined' && process.env?.VITE_WS_URL);
    
  if (envWs && typeof envWs === 'string' && envWs.trim() !== '') {
    const trimmed = envWs.trim();
    return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
  }

  const backendUrl = getBackendUrl();
  if (backendUrl.startsWith('https://')) {
    return backendUrl.replace('https://', 'wss://');
  } else if (backendUrl.startsWith('http://')) {
    return backendUrl.replace('http://', 'ws://');
  }
  return backendUrl;
}

// Fetch with strict timeout capability
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

// Global API Fetch wrapper with automatic authentication token headers, retries, and failure diagnostics
export async function apiFetch(
  endpoint: string, 
  options: RequestInit = {}, 
  retries = 3, 
  baseDelay = 1000
): Promise<Response> {
  const baseUrl = getBackendUrl();
  const token = localStorage.getItem('dotalk_token');
  
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  } as Record<string, string>;

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const fullUrl = `${baseUrl}${cleanEndpoint}`;
  let lastError: any;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // Use fetch with timeout (e.g. 10s per request attempt)
      const response = await fetchWithTimeout(fullUrl, {
        ...options,
        headers
      }, 10000);

      // Retry on temporary server-side crashes/gateways
      if (response.status === 502 || response.status === 503 || response.status === 504) {
        throw new Error(`Server temporarily unavailable (Gateway status: ${response.status})`);
      }

      return response;
    } catch (error: any) {
      lastError = error;
      console.warn(`[DoTalk Network Retry] Attempt ${attempt + 1}/${retries} failed for URL: ${fullUrl}. Error: ${error.message || error}`);
      
      // If we are on the last attempt, run a diagnostic hook in background to update connection status
      if (attempt === retries - 1) {
        runConnectivityDiagnostics().catch(console.error);
      }

      if (attempt < retries - 1) {
        const delay = baseDelay * Math.pow(2, attempt); // Exponential Backoff
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Network request failed after maximum retries');
}

// Global Socket.IO initiator with state sync
let activeSocket: Socket | null = null;
export function getSocketConnection(): Socket {
  if (activeSocket && activeSocket.connected) {
    return activeSocket;
  }

  const socketUrl = getSocketUrl();
  console.log(`[DoTalk Sockets] Initializing connection to: ${socketUrl}`);

  const socket = io(socketUrl, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 15000
  });

  socket.on('connect', () => {
    console.log(`[DoTalk Sockets] Successfully connected to Socket Server! ID: ${socket.id}`);
    latestDiagnostics.socketReachable = true;
    latestDiagnostics.socketError = null;
  });

  socket.on('connect_error', (err) => {
    console.error(`[DoTalk Sockets] Connection error:`, err.message);
    latestDiagnostics.socketReachable = false;
    latestDiagnostics.socketError = err.message;
  });

  activeSocket = socket;
  return socket;
}

// Comprehensive connectivity and environment diagnostics routine
export async function runConnectivityDiagnostics(): Promise<DiagnosticResult> {
  const url = getBackendUrl();
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  
  // Detect sources of the API URL
  let source = 'Dynamic Hardcoded Fallback';
  if (import.meta.env.VITE_API_URL) source = 'import.meta.env.VITE_API_URL';
  else if (import.meta.env.VITE_BACKEND_URL) source = 'import.meta.env.VITE_BACKEND_URL';
  else if (typeof process !== 'undefined' && process.env?.BACKEND_URL) source = 'process.env.BACKEND_URL';
  
  const isUrlValid = typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'));
  const isLocalhost = url.includes('localhost') || url.includes('127.0.0.1') || url.includes('10.0.2.2');
  
  // Under Android, HTTP cleartext traffic is blocked by default starting on Android 9
  const isAndroid = typeof window !== 'undefined' && /android/i.test(window.navigator.userAgent);
  const isCleartextBlocked = isAndroid && url.startsWith('http://') && !isLocalhost;

  const result: DiagnosticResult = {
    apiUrl: url,
    apiUrlSource: source,
    isUrlValid,
    isLocalhost,
    isCleartextBlocked,
    isOnline,
    externalInternetOk: null,
    backendReachable: false,
    backendHttpStatus: null,
    socketReachable: false,
    socketError: null,
    errorClassification: 'UNKNOWN',
    errorMessage: null,
    timestamp: new Date().toISOString(),
  };

  // 1. Check URL configuration
  if (!isUrlValid || url.trim() === '') {
    result.errorClassification = 'INVALID_URL';
    result.errorMessage = 'The API base URL is unconfigured, empty, or lacks an http:// or https:// protocol prefix.';
    latestDiagnostics = result;
    return result;
  }

  // 2. Check general offline state
  if (!isOnline) {
    result.errorClassification = 'LOCAL_OFFLINE';
    result.errorMessage = 'The device has no active internet connection. Please enable Wi-Fi or Cellular network connectivity.';
    latestDiagnostics = result;
    return result;
  }

  // 3. Check cleartext block
  if (isCleartextBlocked) {
    result.errorClassification = 'CLEARTEXT_BLOCKED';
    result.errorMessage = 'Android security policies block plain text HTTP connections (cleartext). The backend URL must use secure HTTPS.';
    latestDiagnostics = result;
    return result;
  }

  // 4. Check external internet connectivity by pinging an open, secure API (Google DNS over HTTPS or cloudflare)
  let internetOk = false;
  try {
    const testFetch = await fetchWithTimeout('https://dns.google/resolve?name=google.com', { method: 'GET' }, 3500);
    internetOk = testFetch.ok;
  } catch (err) {
    internetOk = false;
  }
  result.externalInternetOk = internetOk;

  // 5. Query Backend Health Endpoints (with a shorter timeout)
  try {
    const healthFetch = await fetchWithTimeout(`${url}/health`, { method: 'GET' }, 5000);
    result.backendReachable = healthFetch.ok;
    result.backendHttpStatus = healthFetch.status;
  } catch (err: any) {
    result.backendReachable = false;
    
    // Classify error reasons
    const errMessage = err.message || '';
    if (errMessage.includes('abort') || errMessage.includes('timeout')) {
      result.errorClassification = 'TIMEOUT';
      result.errorMessage = 'Connection request timed out. The backend is taking too long to respond, or the network routing path is blocked.';
    } else if (!internetOk) {
      result.errorClassification = 'LOCAL_OFFLINE';
      result.errorMessage = 'The device appears completely disconnected from the Internet (failed public DNS reachability check).';
    } else {
      result.errorClassification = 'SSL_OR_DNS_ERROR';
      result.errorMessage = 'DNS resolution failed or an SSL/TLS Certificate validation error occurred. Verify that the domain name is correct and has a valid, non-expired SSL certificate.';
    }
    
    latestDiagnostics = result;
    return result;
  }

  if (result.backendReachable) {
    result.errorClassification = 'OK';
    result.errorMessage = null;
  } else {
    result.errorClassification = 'BACKEND_OFFLINE';
    result.errorMessage = `Backend is online but returned an unexpected non-OK response code: ${result.backendHttpStatus}. It might be under maintenance or experiencing server errors.`;
  }

  latestDiagnostics = result;
  return result;
}

// Synchronous diagnostic getter
export function getDiagnostics(): DiagnosticResult {
  return { ...latestDiagnostics, isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true };
}
