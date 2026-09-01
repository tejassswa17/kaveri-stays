import { defineConfig } from 'vite';
import type { IncomingMessage } from 'http';
import react from '@vitejs/plugin-react';

const htmlBypass = (req: IncomingMessage) => {
  // If the browser requests an HTML page navigation (e.g. browser refresh on /properties),
  // bypass the API proxy and return /index.html for React SPA routing.
  if (req.headers.accept && req.headers.accept.includes('text/html')) {
    return '/index.html';
  }
};

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/auth': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/properties': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        bypass: htmlBypass,
      },
      '/bookings': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        bypass: htmlBypass,
      },
      '/guests': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        bypass: htmlBypass,
      },
      '/reports': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        bypass: htmlBypass,
      },
      '/me': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        bypass: htmlBypass,
      },
      '/openapi.json': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
});
