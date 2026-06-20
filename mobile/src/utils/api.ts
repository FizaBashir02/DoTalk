import axios from 'axios';
import io from 'socket.io-client';

// Live hosted API Gateway matching current container routing.
// Allows any standalone Android phone to connect to this server out-of-the-box!
export const BACKEND_URL = 'https://ais-dev-qn4ntqpz5dgge4klsnb3lx-822264812231.asia-southeast1.run.app';

export const api = axios.create({
  baseURL: BACKEND_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

let socket: any = null;

export const getSocket = (token?: string) => {
  if (!socket) {
    socket = io(BACKEND_URL, {
      transports: ['websocket'],
      auth: {
        token,
      },
      autoConnect: true,
    });
  }
  return socket;
};
