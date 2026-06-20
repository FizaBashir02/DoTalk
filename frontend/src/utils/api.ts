import { io, Socket } from 'socket.io-client';

export function getBackendUrl(): string {
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
