import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// BASE_PATH is set by the GitHub Pages workflow (e.g. /yerevan-restaurant/).
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [react()],
  server: {
    proxy: { '/api': 'http://localhost:8000' },
    fs: { allow: ['..'] },
  },
})
