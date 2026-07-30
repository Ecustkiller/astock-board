import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 前端开发时把 /api 代理到本地 wrangler dev（默认 8788），方便本地联调
export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist' },
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8788'
    }
  }
})
