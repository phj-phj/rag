import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import fs from 'fs'

function copyPdfWorker(): Plugin {
  return {
    name: 'copy-pdf-worker',
    closeBundle() {
      const src = path.resolve(__dirname, 'node_modules/pdfjs-dist/build/pdf.worker.mjs')
      const publicDir = path.resolve(__dirname, 'public')
      const dest = path.join(publicDir, 'pdf.worker.mjs')
      if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true })
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest)
        console.log('[pdf-worker] copied to public/pdf.worker.mjs')
      } else {
        console.warn('[pdf-worker] source not found:', src)
      }
    },
  }
}

export default defineConfig({
  plugins: [vue(), tailwindcss(), copyPdfWorker()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    exclude: ['pdfjs-dist'],
  },
})
