import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Use environment variable for base path, fallback to default
const base = process.env.VITE_BASE_PATH || '/';

export default defineConfig({
  plugins: [react()],
  base,
  build: { target: ['safari13','es2018'] },
  esbuild: { target: 'es2018' },
});