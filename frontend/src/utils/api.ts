import { io, Socket } from 'socket.io-client';

export function getBackendUrl(): string {
  const meta = import.meta as any;

  // 1. Check for explicit environment-based configuration from VITE / process environment variables
  const envUrl = 
    meta.env?.VITE_API_URL || 
    meta.env?.VITE_API_BASE_URL || 
    meta.env?.VITE_BACKEND_URL ||
    (typeof process !== 'undefined' && process.env?.BACKEND_URL) ||
    (typeof process !== 'undefined' && process.env?.VITE_API_URL);
    
  if (envUrl) {
    return envUrl.endsWith('/') ? envUrl.slice(0, -1) : envUrl;
  }

  // 2. Fallback to current browser location origin if running under a genuine development cloud/web preview.
  // We bypass this on mobile device webviews (which run on capacitor://localhost, localhost:8080, or file://) to avoid hitting local storage servers.
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    const origin = window.location.origin;
    const isLocalMobileOrCapacitor = 
      origin.includes('localhost') || 
      origin.includes('127.0.0.1') || 
      origin.startsWith('capacitor:') || 
      origin.startsWith('file:');
      
    if (!isLocalMobileOrCapacitor) {
      return origin;
    }
  }

  // 3. Dynamic production fallback
  return 'https://dotalk-production.up.railway.app';
}

// Global fetch wrapper with automatic Authorization token inject and resilient retry capability
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
  let lastError: any;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(`${baseUrl}${cleanEndpoint}`, {
        ...options,
        headers
      });

      // Retry on 5xx temporary server drops/gateway errors
      if (response.status === 502 || response.status === 503 || response.status === 504) {
        throw new Error(`Server temporarily unavailable (${response.status})`);
      }

      return response;
    } catch (error: any) {
      lastError = error;
      console.warn(`[DoTalk Network Retry] Attempt ${attempt + 1}/${retries} failed for endpoint: ${cleanEndpoint}. Retrying...`, error.message || error);
      
      if (attempt < retries - 1) {
        const delay = baseDelay * Math.pow(2, attempt); // Exponential Backoff
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Network request failed after maximum retries');
}

export function getSocketUrl(): string {
  const meta = import.meta as any;
  const envWs = 
    meta.env?.VITE_WS_URL || 
    meta.env?.VITE_SOCKET_URL ||
    meta.env?.WS_URL ||
    (typeof process !== 'undefined' && process.env?.WS_URL) ||
    (typeof process !== 'undefined' && process.env?.VITE_WS_URL);
    
  if (envWs) {
    return envWs.endsWith('/') ? envWs.slice(0, -1) : envWs;
  }
  return getBackendUrl();
}

// Global Socket.IO initiator with auto-reconnection and aggressive retry handling
export function getSocketConnection(): Socket {
  const socketUrl = getSocketUrl();
  return io(socketUrl, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity, // Keep retrying reconnection forever
    reconnectionDelay: 1000,        // Start with 1s reconnect wait time
    reconnectionDelayMax: 5000,     // Max delay of 5s between retries
    timeout: 20000                  // Extended connection attempt threshold to 20s
  });
}
