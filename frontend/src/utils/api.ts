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

  // 2. Route production builds and Vercel deployments directly to the live Railway API gateway
  if (
    meta.env?.PROD || 
    (typeof window !== 'undefined' && (
      window.location.hostname.includes('vercel.app') || 
      window.location.hostname.includes('amplifyapp.com') ||
      window.location.hostname.includes('netlify.app')
    ))
  ) {
    return 'https://dotalk-production.up.railway.app';
  }

  // 3. Fall back to local same-origin routing in development
  return window.location.origin;
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
