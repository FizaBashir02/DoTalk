/// <reference types="vite/client" />
import { io, Socket } from 'socket.io-client';

export type DiagnosticErrorType =
  | 'OK'
  | 'API URL Missing'
  | 'API URL Invalid'
  | 'Railway Server Offline'
  | 'Railway Timeout'
  | 'Socket Connection Failed'
  | 'CORS Blocked'
  | 'SSL Certificate Error'
  | 'DNS Resolution Failed'
  | 'UNKNOWN';

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
  errorClassification: DiagnosticErrorType;
  errorMessage: string | null;
  timestamp: string;
  fetchUrl?: string;
  responseBody?: string;
  exceptionMessage?: string;
  exceptionStack?: string;
  errorName?: string;
  realErrorMessage?: string;
  realRequestedUrl?: string;
  realHttpStatus?: string | number;
  realResponseBody?: string;
  capacitorPlatform?: string;
  buildMode?: string;
  envVariables?: Record<string, string>;
}

export interface EndpointResult {
  url: string;
  status: number | null;
  body: string;
  error: string | null;
  method: string;
}

export interface DebugInfo {
  currentApiUrl: string;
  healthResult: EndpointResult | null;
  rootResult: EndpointResult | null;
  socketStatus: {
    url: string;
    state: string; // 'connected' | 'disconnected' | 'connecting' | 'error'
    error: string | null;
  } | null;
  lastFetchError: {
    url: string;
    method: string;
    statusCode: number | null;
    responseBody: string;
    exceptionMessage: string;
    exceptionStack: string;
    timestamp: string;
  } | null;
  lastSocketError: {
    url: string;
    error: string;
    timestamp: string;
  } | null;
}

// Global debug store
export let globalDebugInfo: DebugInfo = {
  currentApiUrl: '',
  healthResult: null,
  rootResult: null,
  socketStatus: null,
  lastFetchError: null,
  lastSocketError: null,
};

export function getDebugInfo(): DebugInfo {
  globalDebugInfo.currentApiUrl = getBackendUrl();
  return { ...globalDebugInfo };
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
  // 1. Check for any active user-defined override from the diagnostics console
  if (typeof window !== 'undefined' && window.localStorage) {
    const override = window.localStorage.getItem('dotalk_custom_api_url');
    if (override && override.trim() !== '') {
      const trimmed = override.trim();
      return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
    }
  }

  // 2. For non-local web deployment preview and sharing URLs, prioritize the current origin.
  // This guarantees that any client running inside an iframe or browser tab dynamically
  // points to its corresponding backend server without stale environment variable side-effects.
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    const origin = window.location.origin;
    if (
      origin.startsWith('http') && 
      !origin.includes('localhost') && 
      !origin.includes('127.0.0.1') && 
      !origin.includes('10.0.2.2')
    ) {
      return origin.endsWith('/') ? origin.slice(0, -1) : origin;
    }
  }

  // 3. Read environment variables loaded by Vite (either at compile time or via define plugin)
  const envUrl = 
    import.meta.env.VITE_API_URL || 
    import.meta.env.VITE_BACKEND_URL || 
    import.meta.env.VITE_API_BASE_URL ||
    (typeof process !== 'undefined' && process.env?.BACKEND_URL) ||
    (typeof process !== 'undefined' && process.env?.VITE_API_URL);
    
  if (envUrl && typeof envUrl === 'string' && envUrl.trim() !== '') {
    const trimmed = envUrl.trim();
    if (
      !trimmed.includes('localhost') &&
      !trimmed.includes('127.0.0.1') &&
      !trimmed.includes('10.0.2.2')
    ) {
      return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
    }
  }

  // 4. Strict default fallback for production (eliminating all insecure localhost loops)
  return 'https://dotalk-production.up.railway.app';
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
  const method = options.method || 'GET';
  
  console.log(`[DoTalk Fetch] Exact URL requested: "${fullUrl}"`);
  console.log(`[DoTalk Fetch] HTTP method: "${method}"`);
  
  let lastError: any;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetchWithTimeout(fullUrl, {
        ...options,
        headers
      }, 10000);

      console.log(`[DoTalk Fetch Success] URL: "${fullUrl}", Status: ${response.status}`);

      // If response status is not 2xx, log the detailed response body
      if (!response.ok) {
        try {
          const cloned = response.clone();
          const responseText = await cloned.text();
          console.error(`[DoTalk Fetch Non-OK Status Details]:
            URL: ${fullUrl}
            METHOD: ${method}
            STATUS: ${response.status}
            RESPONSE: ${responseText || 'Empty'}
            ERROR: HTTP Status indicates failure`);
        } catch (cloneErr) {
          console.error(`[DoTalk Fetch Non-OK Status Details]:
            URL: ${fullUrl}
            METHOD: ${method}
            STATUS: ${response.status}
            RESPONSE: (Failed to clone response body)
            ERROR: HTTP Status indicates failure`);
        }
      }

      // Retry on temporary server-side crashes/gateways
      if (response.status === 502 || response.status === 503 || response.status === 504) {
        throw new Error(`Server temporarily unavailable (Gateway status: ${response.status})`);
      }

      return response;
    } catch (error: any) {
      lastError = error;
      console.error(`[DoTalk Network Attempt Failed] Attempt ${attempt + 1}/${retries} for URL: ${fullUrl}. Exception: ${error.message || error}`);
      
      // Detailed standardized console logging format as requested by production audit
      console.error(`[DoTalk Fetch Failure Details]:
        URL: ${fullUrl}
        METHOD: ${method}
        STATUS: ${error.status || 'Failed to fetch / Connection Timeout'}
        RESPONSE: None (Network Exception)
        ERROR: ${error.message || String(error)}`);

      // Save last fetch error details
      globalDebugInfo.lastFetchError = {
        url: fullUrl,
        method,
        statusCode: error.status || null,
        responseBody: '',
        exceptionMessage: error.message || String(error),
        exceptionStack: error.stack || '',
        timestamp: new Date().toISOString()
      };

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
  console.log(`[DoTalk Sockets] Current connection state: connecting`);

  const socket = io(socketUrl, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 15000
  });

  globalDebugInfo.socketStatus = {
    url: socketUrl,
    state: 'connecting',
    error: null
  };

  socket.on('connect', () => {
    console.log(`[DoTalk Sockets] Successfully connected to Socket Server! ID: ${socket.id}`);
    console.log(`[DoTalk Sockets] Socket.IO connection state: connected`);
    latestDiagnostics.socketReachable = true;
    latestDiagnostics.socketError = null;

    globalDebugInfo.socketStatus = {
      url: socketUrl,
      state: 'connected',
      error: null
    };
  });

  socket.on('connect_error', (err) => {
    console.error(`[DoTalk Sockets] Connection error on ${socketUrl}:`, err.message);
    console.error(`[DoTalk Sockets] Socket.IO connection state: error`);
    latestDiagnostics.socketReachable = false;
    latestDiagnostics.socketError = err.message;

    globalDebugInfo.socketStatus = {
      url: socketUrl,
      state: 'error',
      error: err.message
    };

    globalDebugInfo.lastSocketError = {
      url: socketUrl,
      error: err.message,
      timestamp: new Date().toISOString()
    };
  });

  activeSocket = socket;
  return socket;
}

// Comprehensive connectivity and environment diagnostics routine
export async function runConnectivityDiagnostics(): Promise<DiagnosticResult> {
  const url = getBackendUrl();
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  
  // Detect sources of the API URL
  let source = 'No Env Loaded';
  if (import.meta.env.VITE_API_URL) source = 'import.meta.env.VITE_API_URL';
  else if (import.meta.env.VITE_BACKEND_URL) source = 'import.meta.env.VITE_BACKEND_URL';
  else if (typeof process !== 'undefined' && process.env?.BACKEND_URL) source = 'process.env.BACKEND_URL';
  else if (typeof window !== 'undefined' && window.localStorage && window.localStorage.getItem('dotalk_custom_api_url')) source = 'localStorage Override';
  
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
    fetchUrl: '',
    responseBody: '',
    exceptionMessage: '',
    exceptionStack: '',
    capacitorPlatform: typeof window !== 'undefined' && (window as any).Capacitor ? (window as any).Capacitor.getPlatform() : 'web',
    buildMode: import.meta.env.MODE || 'unknown',
    envVariables: {
      VITE_API_URL: import.meta.env.VITE_API_URL || '',
      VITE_BACKEND_URL: import.meta.env.VITE_BACKEND_URL || '',
      VITE_WS_URL: import.meta.env.VITE_WS_URL || '',
    }
  };

  globalDebugInfo.currentApiUrl = url;

  console.log('=== DO-TALK DIAGNOSTICS PROBE RUN ===');
  console.log(`[Diagnostics] Exact API Base URL Tested: "${url}"`);
  console.log(`[Diagnostics] Source: ${source}`);
  console.log(`[Diagnostics] Navigator isOnline: ${isOnline}`);

  // 1. Check URL configuration
  if (url.trim() === '') {
    result.errorClassification = 'API URL Missing';
    result.errorMessage = 'The API base URL is unconfigured or empty. Please specify a valid server endpoint.';
    result.errorName = 'ConfigError';
    result.realErrorMessage = 'The API base URL is unconfigured or empty.';
    result.realRequestedUrl = 'None';
    result.realHttpStatus = 'Unsent';
    result.realResponseBody = 'None';
    result.exceptionMessage = 'Error Name: ConfigError\nError Message: The API base URL is unconfigured or empty.\nRequested URL: None\nHTTP Status: Unsent\nResponse Body: None';
    latestDiagnostics = result;
    console.error(`[Diagnostics Error] ${result.errorClassification}: ${result.errorMessage}`);
    return result;
  }

  if (!isUrlValid) {
    result.errorClassification = 'API URL Invalid';
    result.errorMessage = 'The API base URL lacks a valid protocol prefix. It must start with http:// or https://.';
    result.errorName = 'ConfigError';
    result.realErrorMessage = 'The API base URL lacks a valid protocol prefix. It must start with http:// or https://.';
    result.realRequestedUrl = url;
    result.realHttpStatus = 'Unsent';
    result.realResponseBody = 'None';
    result.exceptionMessage = `Error Name: ConfigError\nError Message: The API base URL lacks a valid protocol prefix.\nRequested URL: ${url}\nHTTP Status: Unsent\nResponse Body: None`;
    latestDiagnostics = result;
    console.error(`[Diagnostics Error] ${result.errorClassification}: ${result.errorMessage}`);
    return result;
  }

  // 2. Check general offline state
  if (!isOnline) {
    result.errorClassification = 'DNS Resolution Failed';
    result.errorMessage = 'The device has no active internet connection. Please enable Wi-Fi or Cellular network connectivity.';
    result.errorName = 'NetworkError';
    result.realErrorMessage = 'The device has no active internet connection.';
    result.realRequestedUrl = url;
    result.realHttpStatus = 'Unsent';
    result.realResponseBody = 'None';
    result.exceptionMessage = `Error Name: NetworkError\nError Message: The device has no active internet connection.\nRequested URL: ${url}\nHTTP Status: Unsent\nResponse Body: None`;
    latestDiagnostics = result;
    console.error(`[Diagnostics Error] ${result.errorClassification}: ${result.errorMessage}`);
    return result;
  }

  // 3. Check cleartext block
  if (isCleartextBlocked) {
    result.errorClassification = 'SSL Certificate Error';
    result.errorMessage = 'Android security policies block plain text HTTP cleartext connections. The backend URL must use secure HTTPS.';
    result.errorName = 'SecurityError';
    result.realErrorMessage = 'Android security policies block plain text HTTP cleartext connections.';
    result.realRequestedUrl = url;
    result.realHttpStatus = 'Unsent';
    result.realResponseBody = 'None';
    result.exceptionMessage = `Error Name: SecurityError\nError Message: Android security policies block plain text HTTP cleartext connections.\nRequested URL: ${url}\nHTTP Status: Unsent\nResponse Body: None`;
    latestDiagnostics = result;
    console.error(`[Diagnostics Error] ${result.errorClassification}: ${result.errorMessage}`);
    return result;
  }

  // 4. Check external internet connectivity by pinging Google DNS
  let internetOk = false;
  try {
    const testFetch = await fetchWithTimeout('https://dns.google/resolve?name=google.com', { method: 'GET' }, 4000);
    internetOk = testFetch.ok;
  } catch (err) {
    internetOk = false;
  }
  result.externalInternetOk = internetOk;

  // 5. Query /health first as requested
  const healthUrl = `${url}/health`;
  result.fetchUrl = healthUrl;
  console.log(`[Diagnostics Check] Exact URL requested: "${healthUrl}"`);
  console.log(`[Diagnostics Check] HTTP method: "GET"`);
  
  try {
    const response = await fetchWithTimeout(healthUrl, { method: 'GET' }, 6000);
    const bodyText = await response.text();
    console.log(`[Diagnostics Check] HTTP status code: ${response.status}`);
    console.log(`[Diagnostics Check] Response body: "${bodyText}"`);

    globalDebugInfo.healthResult = {
      url: healthUrl,
      status: response.status,
      body: bodyText,
      error: null,
      method: 'GET'
    };

    result.backendHttpStatus = response.status;
    result.backendReachable = response.ok;
    result.responseBody = bodyText;

    if (response.ok) {
      result.errorClassification = 'OK';
      result.errorMessage = null;
    } else {
      result.errorClassification = 'Railway Server Offline';
      result.errorMessage = `Server returned an unexpected HTTP status code on /health: ${response.status}`;
      
      // Store exact non-ok response info
      result.errorName = 'HTTPError';
      result.realErrorMessage = `Server returned status code ${response.status} on /health`;
      result.realRequestedUrl = healthUrl;
      result.realHttpStatus = response.status;
      result.realResponseBody = bodyText;
      result.exceptionMessage = `Error Name: HTTPError\nError Message: Server returned status code ${response.status}\nRequested URL: ${healthUrl}\nHTTP Status: ${response.status}\nResponse Body: ${bodyText}`;
    }
  } catch (err: any) {
    console.error(`[Diagnostics Check] /health failed with exception:`, err.message || err);
    console.error(`[Diagnostics Check] Actual JavaScript exception:`, err);
    
    globalDebugInfo.healthResult = {
      url: healthUrl,
      status: null,
      body: '',
      error: err.message || String(err),
      method: 'GET'
    };

    result.backendReachable = false;
    
    const errName = err.name || 'TypeError';
    const errMessage = err.message || String(err);
    
    result.errorName = errName;
    result.realErrorMessage = errMessage;
    result.realRequestedUrl = healthUrl;
    result.realHttpStatus = 'Failed to fetch';
    result.realResponseBody = 'None';
    
    result.exceptionMessage = `Error Name: ${errName}\nError Message: ${errMessage}\nRequested URL: ${healthUrl}\nHTTP Status: Failed to fetch\nResponse Body: None`;
    result.exceptionStack = err.stack || '';

    // Save in last fetch error
    globalDebugInfo.lastFetchError = {
      url: healthUrl,
      method: 'GET',
      statusCode: null,
      responseBody: '',
      exceptionMessage: err.message || String(err),
      exceptionStack: err.stack || '',
      timestamp: new Date().toISOString()
    };
  }

  // 6. Query root / as well (to have both, and fallback if health was blocked or didn't answer)
  const rootUrl = `${url}/`;
  console.log(`[Diagnostics Check] Exact URL requested: "${rootUrl}"`);
  console.log(`[Diagnostics Check] HTTP method: "GET"`);
  
  try {
    const response = await fetchWithTimeout(rootUrl, { method: 'GET' }, 6000);
    const bodyText = await response.text();
    console.log(`[Diagnostics Check] HTTP status code: ${response.status}`);
    console.log(`[Diagnostics Check] Response body: "${bodyText}"`);

    globalDebugInfo.rootResult = {
      url: rootUrl,
      status: response.status,
      body: bodyText,
      error: null,
      method: 'GET'
    };

    if (!result.backendReachable) {
      result.backendHttpStatus = response.status;
      result.backendReachable = response.ok;
      result.responseBody = bodyText;
      if (response.ok) {
        result.errorClassification = 'OK';
        result.errorMessage = null;
        result.errorName = undefined;
        result.realErrorMessage = undefined;
        result.realRequestedUrl = undefined;
        result.realHttpStatus = undefined;
        result.realResponseBody = undefined;
        result.exceptionMessage = undefined;
      } else {
        result.errorClassification = 'Railway Server Offline';
        result.errorMessage = `Server returned an unexpected HTTP status code on /: ${response.status}`;
        
        result.errorName = 'HTTPError';
        result.realErrorMessage = `Server returned status code ${response.status} on /`;
        result.realRequestedUrl = rootUrl;
        result.realHttpStatus = response.status;
        result.realResponseBody = bodyText;
        result.exceptionMessage = `Error Name: HTTPError\nError Message: Server returned status code ${response.status}\nRequested URL: ${rootUrl}\nHTTP Status: ${response.status}\nResponse Body: ${bodyText}`;
      }
    }
  } catch (err: any) {
    console.error(`[Diagnostics Check] Root / failed with exception:`, err.message || err);
    console.error(`[Diagnostics Check] Actual JavaScript exception:`, err);

    globalDebugInfo.rootResult = {
      url: rootUrl,
      status: null,
      body: '',
      error: err.message || String(err),
      method: 'GET'
    };

    if (!result.backendReachable) {
      const errMessage = err.message || '';
      const errName = err.name || '';
      
      result.errorName = errName || 'TypeError';
      result.realErrorMessage = errMessage || String(err);
      result.realRequestedUrl = rootUrl;
      result.realHttpStatus = 'Failed to fetch';
      result.realResponseBody = 'None';
      
      result.exceptionMessage = `Error Name: ${errName || 'TypeError'}\nError Message: ${errMessage || String(err)}\nRequested URL: ${rootUrl}\nHTTP Status: Failed to fetch\nResponse Body: None`;
      result.exceptionStack = err.stack || '';

      // Differentiate CORS Blocked vs actual network exceptions
      let isCorsError = false;
      try {
        await fetchWithTimeout(rootUrl, { method: 'GET', mode: 'no-cors' }, 4000);
        isCorsError = true;
      } catch (cErr) {
        isCorsError = false;
      }

      if (isCorsError) {
        result.errorClassification = 'CORS Blocked';
        result.errorMessage = `CORS Error: Connection rejected by client browser security policies. The backend is online but is missing appropriate CORS header configurations. Exception: ${errMessage}`;
      } else if (errName === 'AbortError' || errMessage.includes('abort') || errMessage.includes('timeout')) {
        result.errorClassification = 'Railway Timeout';
        result.errorMessage = `Connection Timed Out: The request timed out after 6000ms. Exception: ${errMessage}`;
      } else if (!isOnline || !internetOk) {
        result.errorClassification = 'DNS Resolution Failed';
        result.errorMessage = `Local Network Offline: Could not reach the internet or resolve DNS. Exception: ${errMessage}`;
      } else {
        const lowerMsg = errMessage.toLowerCase();
        if (lowerMsg.includes('ssl') || lowerMsg.includes('cert') || lowerMsg.includes('tls') || lowerMsg.includes('handshake')) {
          result.errorClassification = 'SSL Certificate Error';
          result.errorMessage = `SSL Certificate Error: Secure handshake verification failed. The backend domain may have an invalid, untrusted, or expired certificate. Exception: ${errMessage}`;
        } else if (lowerMsg.includes('dns') || lowerMsg.includes('resolve') || lowerMsg.includes('enotfound') || lowerMsg.includes('host')) {
          result.errorClassification = 'DNS Resolution Failed';
          result.errorMessage = `DNS Resolution Failed: The hostname in the API URL could not be resolved to an IP address. Check for typos. Exception: ${errMessage}`;
        } else {
          result.errorClassification = 'Railway Server Offline';
          result.errorMessage = `Railway Server Offline: The target backend is unreachable. Exception: ${errMessage}`;
        }
      }
    }
  }

  // 7. Test Socket.IO websocket connection
  console.log('[Diagnostics Check] Testing Socket.IO websocket connection next...');
  const wsUrl = getSocketUrl();
  console.log(`[Diagnostics Check] Socket.IO connection state: connecting`);
  
  try {
    const testSocket = io(wsUrl, {
      transports: ['websocket', 'polling'],
      timeout: 6000,
      reconnection: false
    });

    globalDebugInfo.socketStatus = {
      url: wsUrl,
      state: 'connecting',
      error: null
    };

    const connectionResult = await new Promise<{ ok: boolean; err: string | null }>((resolve) => {
      testSocket.on('connect', () => {
        resolve({ ok: true, err: null });
      });
      testSocket.on('connect_error', (err) => {
        resolve({ ok: false, err: err.message });
      });
    });

    testSocket.disconnect();

    result.socketReachable = connectionResult.ok;
    result.socketError = connectionResult.err;

    globalDebugInfo.socketStatus = {
      url: wsUrl,
      state: connectionResult.ok ? 'connected' : 'error',
      error: connectionResult.err
    };

    if (connectionResult.ok) {
      console.log(`[Diagnostics Check] Socket.IO connection succeeded!`);
      console.log(`[Diagnostics Check] Socket.IO connection state: connected`);
      if (result.errorClassification === 'UNKNOWN') {
        result.errorClassification = 'OK';
        result.errorMessage = null;
      }
    } else {
      console.error(`[Diagnostics Check] Socket.IO connection failed:`, connectionResult.err);
      console.error(`[Diagnostics Check] Socket.IO connection state: error`);
      
      globalDebugInfo.lastSocketError = {
        url: wsUrl,
        error: connectionResult.err || 'Unknown connection error',
        timestamp: new Date().toISOString()
      };

      if (result.backendReachable) {
        result.errorClassification = 'Socket Connection Failed';
        result.errorMessage = `Socket Connection Failed: HTTP API is active, but Socket.IO WebSocket handshake failed. Error: ${connectionResult.err || 'Timeout'}`;
      }
    }
  } catch (sockErr: any) {
    result.socketReachable = false;
    result.socketError = sockErr.message || String(sockErr);
    console.error(`[Diagnostics Check] Socket.IO test threw exception:`, sockErr);
    console.error(`[Diagnostics Check] Socket.IO connection state: error`);

    globalDebugInfo.socketStatus = {
      url: wsUrl,
      state: 'error',
      error: sockErr.message || String(sockErr)
    };

    globalDebugInfo.lastSocketError = {
      url: wsUrl,
      error: sockErr.message || String(sockErr),
      timestamp: new Date().toISOString()
    };
  }

  console.log('=== DO-TALK DIAGNOSTICS PROBE COMPLETE ===');
  console.log(`[Diagnostics] Error Category: "${result.errorClassification}"`);
  console.log(`[Diagnostics] Error Message: "${result.errorMessage}"`);
  
  latestDiagnostics = result;
  return result;
}

// Synchronous diagnostic getter
export function getDiagnostics(): DiagnosticResult {
  return { ...latestDiagnostics, isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true };
}
