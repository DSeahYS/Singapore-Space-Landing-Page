import { defineConfig } from 'vite';
import cesium from 'vite-plugin-cesium';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  plugins: [cesium()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    target: 'esnext'
  },
  optimizeDeps: {
    exclude: ['satellite.js']
  },
  server: {
    port: 5173,
    open: true,
  },
});
