import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: 'src/web',
  build: {
    outDir: '../../dist/web',
    emptyDirOnBuild: true,
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  server: {
    port: 3100,
    proxy: {
      '/api': 'http://localhost:3101',
      '/ws': {
        target: 'ws://localhost:3101',
        ws: true,
      },
    },
  },
})
