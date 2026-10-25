import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
    // Closed-source: do not ship reconstructable TS via client source maps in the NSIS app.
    sourcemap: false,
  },
});
