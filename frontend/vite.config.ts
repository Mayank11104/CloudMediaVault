import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    global: 'globalThis',
  },
  // 🔥 ADD THIS BLOCK:
  server: {
    proxy: {
      '/api': {
        target: 'http://alb-cloudmedia-1802896494.eu-west-1.elb.amazonaws.com',
        changeOrigin: true,
        secure: false,  // ALB HTTP only for now
        rewrite: (path) => path.replace(/^\/api/, '/api')  // Keep /api prefix
      }
    }
  }
})
