import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Load environment variables from the project root directory
  const env = loadEnv(mode, path.resolve(__dirname), '');

  return {
    root: 'frontend',
    envDir: '..', // Instruct Vite to look for .env files in the project root
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'frontend/src'),
      },
    },
    define: {
      // Statically inject environment variables into the React bundle.
      // This is crucial for Capacitor APKs where process.env is undefined at runtime.
      'process.env.BACKEND_URL': JSON.stringify(env.BACKEND_URL || env.VITE_BACKEND_URL || env.VITE_API_URL || ''),
      'process.env.VITE_API_URL': JSON.stringify(env.VITE_API_URL || env.VITE_BACKEND_URL || env.BACKEND_URL || ''),
      'process.env.WS_URL': JSON.stringify(env.WS_URL || env.VITE_WS_URL || ''),
      'process.env.VITE_WS_URL': JSON.stringify(env.VITE_WS_URL || env.WS_URL || ''),
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      outDir: '../dist',
      emptyOutDir: true,
    }
  };
});
