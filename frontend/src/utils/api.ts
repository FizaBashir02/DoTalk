import { io, Socket } from 'socket.io-client';

export function getBackendUrl(): string {
  const meta = import.meta as any;

  // 1. Check for explicit environment-based configuration from VITE environment variables
  const envUrl = 
    meta.env?.VITE_API_URL || 
    meta.env?.VITE_API_BASE_URL || 
    meta.env?.VITE_BACKEND_URL;
    
  if (envUrl) {
    return envUrl.endsWith('/') ? envUrl.slice(0, -1) : envUrl;
  }

  // 2. Fallback to current browser location origin if running under development preview
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    return window.location.origin;
  }

  // 3. Route always to the live Railway API gateway for production/mobile fallback
  return 'https://dotalk-production.up.railway.app';
}

// Global fetch wrapper with automatic Authorization token inject
export async function apiFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
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
  
  return fetch(`${baseUrl}${cleanEndpoint}`, {
    ...options,
    headers
  });
}

// Global Socket.IO initiator
export function getSocketConnection(): Socket {
  const baseUrl = getBackendUrl();
  return io(baseUrl, {
    transports: ['websocket', 'polling']
  });
}
