import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Served at /admin/ next to the public site; in production it builds into frontend/dist/admin.
export default defineConfig({
  base: '/admin/',
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  build: { outDir: '../frontend/dist/admin', emptyOutDir: true },
  server: {
    port: 5174,
    proxy: {
      '/api': process.env.API_PROXY || 'http://localhost:8000',
      '/images': process.env.SITE_PROXY || 'http://localhost:5173', // seeded dish photos live in the public site
    },
  },
})
