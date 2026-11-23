import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    watch: {
      // Docker Desktop on Windows does not always forward filesystem events.
      usePolling: true,
      interval: 250,
    },
    proxy: { '/api': 'http://localhost:18000' },
  },
})
