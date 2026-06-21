import axios from 'axios';
import io from 'socket.io-client';

/**
 * CONFIGURABLE API_BASE_URL
 * Change this string to point to your backend.
 * 
 * - For Android Emulator + Local Backend: Use 'http://10.0.2.2:3000'
 * - For Physical Device + Local Backend: Use your computer's local IP (e.g. 'http://192.168.1.50:3000')
 * - For Production Backend: Use your deployment URL (e.g. 'https://ais-dev-qn4ntqpz5dgge4klsnb3lx-822264812231.asia-southeast1.run.app')
 */
export const API_BASE_URL = 'https://ais-dev-qn4ntqpz5dgge4klsnb3lx-822264812231.asia-southeast1.run.app';

// Backward compatibility fallback for other files
export const BACKEND_URL = API_BASE_URL;

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 12000, // Slightly more buffer for physical mobile devices on slower connections
  headers: {
    'Content-Type': 'application/json',
  },
});

// Detailed Console Logging on outgoing API requests
api.interceptors.request.use(
  (config) => {
    console.log(`[API Request] [${config.method?.toUpperCase()}] URL: ${config.baseURL || ''}${config.url}`, {
      headers: config.headers,
      data: config.data,
      params: config.params,
    });
    return config;
  },
  (error) => {
    console.error(`[API Request Compilation Failure]`, error);
    return Promise.reject(error);
  }
);

// Detailed Logging, Authentication Error Interception & Self-Healing Retry Logic
api.interceptors.response.use(
  (response) => {
    console.log(`[API Response] STATUS: ${response.status} URL: ${response.config.url}`, {
      data: response.data,
    });
    return response;
  },
  async (error) => {
    const { config, response, message } = error;

    // 1. Log explicit Authentication / Authorization failures
    if (response && (response.status === 401 || response.status === 403)) {
      console.error(`[API Authentication Failure] STATUS: ${response.status} URL: ${config?.url || ''}`, response.data);
    } 
    // 2. Log regular network/DNS/Server connection issues
    else {
      console.error(
        `[API Connection & General Failure] ` +
        `Message: ${message || 'No client message'} | ` +
        `Status: ${response?.status || 'No Response'} | ` +
        `URL: ${config?.url || ''}`,
        response?.data || 'Empty response payload'
      );
    }

    // 3. Resilient Self-Healing Automatic Retry Logic for connection glitches & transient errors
    const isNetworkError = !response;
    const isServerError = response && response.status >= 500;
    const isRateLimited = response && response.status === 429;

    if ((isNetworkError || isServerError || isRateLimited) && config) {
      config._retryCount = config._retryCount || 0;
      const MAX_RETRIES = 3;
      const RETRY_DELAY_MS = 1500; // Delay before each retry attempt

      if (config._retryCount < MAX_RETRIES) {
        config._retryCount++;
        console.warn(
          `[API Self-Healing Auto-Retry] Detected transient network/server glitch for ${config.url || ''}. ` +
          `Retrying request ... (Attempt ${config._retryCount}/${MAX_RETRIES}) in ${RETRY_DELAY_MS}ms`
        );
        
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        return api(config);
      }
    }

    return Promise.reject(error);
  }
);

/**
 * Parses axios/network error and prepares highly explicit clear advice to help
 * physical devices, emulators, and testers establish API gateway contact on the fly.
 */
export function getDiagnosticErrorMessage(err: any): string {
  if (!err) {
    return 'An unknown validation error occurred.';
  }

  // Handle typical Axios networking/timeout issues
  if (!err.response) {
    const connMessage = err.message || '';
    const code = err.code || '';
    return (
      `Network Connection Failed!\n\n` +
      `Failed to contact server at:\n${API_BASE_URL}\n\n` +
      `🔍 Possible Causes:\n` +
      `• Local emulator can't route "localhost". Use 10.0.2.2 instead.\n` +
      `• Physical device of developer is not on the same Wi-Fi network.\n` +
      `• The server is offline or binding process lacks PORT config.\n\n` +
      `Diagnostics: ${connMessage} [${code}]`
    );
  }

  // Handle actual server response errors
  const status = err.response.status;
  const serverErrorMsg = err.response.data?.error || err.response.data?.message;

  if (serverErrorMsg) {
    return `Server Error: ${serverErrorMsg}`;
  }

  if (status >= 500) {
    return `Internal Server Error (${status}). Code failed to handle the parameters. See server stack logs.`;
  }

  return `Request Failed with HTTP Code ${status}.`;
}

let socket: any = null;

export const getSocket = (token?: string) => {
  if (!socket) {
    socket = io(API_BASE_URL, {
      transports: ['websocket'],
      auth: {
        token,
      },
      autoConnect: true,
    });
    
    socket.on('connect', () => {
      console.log('[Socket] Connected successfully to live websocket stream!', API_BASE_URL);
    });

    socket.on('connect_error', (err: any) => {
      console.error('[Socket Connection Error] Failed web-socket transport setup:', err.message || err);
    });
  }
  return socket;
};
