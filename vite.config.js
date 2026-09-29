import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [preact()],
  resolve: {
    alias: { 'react': 'preact/compat', 'react-dom': 'preact/compat' },
    // Force single preact instance — prevents hooks conflict from preact-router or other deps
    dedupe: ['preact', 'preact/hooks', 'preact/compat'],
  },
  server: {
    allowedHosts: [
      'stress-survivor.thenextgenseo.online',
      '.thenextgenseo.online',
    ],
    host: '0.0.0.0',
    port: 5173,
  },
});
