import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/compile':       'https://vec-production-e1fe.up.railway.app',
      '/health':        'https://vec-production-e1fe.up.railway.app',
      '/phases':        'https://vec-production-e1fe.up.railway.app',
      '/execute':       'https://vec-production-e1fe.up.railway.app',
      '/auth':          'https://vec-production-e1fe.up.railway.app',
      '/user':          'https://vec-production-e1fe.up.railway.app',
    }
  }
})
