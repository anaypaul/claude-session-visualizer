import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3458,
    proxy: {
      '/api': {
        target: 'http://localhost:3457',
        changeOrigin: true,
      },
      '/events': {
        target: 'http://localhost:3457',
        changeOrigin: true,
      },
    },
  },
});
