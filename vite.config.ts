import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/cocktails/',
  build: { target: ['es2018', 'safari13'] },
  esbuild: { target: 'es2018' },
})
