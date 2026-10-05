import { defineConfig } from 'vite';
export default defineConfig({
  cacheDir: '.vite-cache',
  resolve: { dedupe: ['three'] },
  optimizeDeps: { entries: ['index.html', 'preview/*.html'] },
  server: { host: '127.0.0.1', port: 3300, strictPort: true },
  // Rapier compat embeds ~4.3 MB of WASM/JS; isolate this indivisible payload.
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 4500,
    rollupOptions: {
      input: 'index.html',
      output: {
        manualChunks: (id) => id.includes('/@dimforge/rapier3d-compat/') ? 'rapier' : undefined,
      },
    },
  },
});
