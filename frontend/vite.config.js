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
      '/compile': { target: 'https://vec-production-e1fe.up.railway.app', changeOrigin: true, secure: false },
      '/health':  { target: 'https://vec-production-e1fe.up.railway.app', changeOrigin: true, secure: false },
      '/phases':  { target: 'https://vec-production-e1fe.up.railway.app', changeOrigin: true, secure: false },
      '/execute': { target: 'https://vec-production-e1fe.up.railway.app', changeOrigin: true, secure: false },
      '/auth':    { target: 'https://vec-production-e1fe.up.railway.app', changeOrigin: true, secure: false },
      '/user':    { target: 'https://vec-production-e1fe.up.railway.app', changeOrigin: true, secure: false },
    }
  }
})
