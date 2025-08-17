// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',  // relative asset paths
  build: { target: ['safari13','es2018'] },
  esbuild: { target: 'es2018' },
});