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
      '/compile':       'http://localhost:5000',
      '/health':        'http://localhost:5000',
      '/phases':        'http://localhost:5000',
      '/execute':       'http://localhost:5000',
      '/auth':          'http://localhost:5000',
      '/user':          'http://localhost:5000',
    }
  }
})
