import { defineConfig } from 'vite';
import { execFileSync } from 'node:child_process';
import { assetVersionsDefine, rapierWasmFile } from './tools/build/load-plugins';
let buildCommit = 'unknown';
try { buildCommit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { /* Source archives may not include Git metadata. */ }
export default defineConfig({
  define: { __BUILD_COMMIT__: JSON.stringify(buildCommit) },
  cacheDir: '.vite-cache',
  plugins: [rapierWasmFile(), assetVersionsDefine()],
  resolve: { dedupe: ['three'] },
  optimizeDeps: { entries: ['index.html', 'preview/*.html'] },
  server: { host: '127.0.0.1', port: 3300, strictPort: true },
  // Hashed bundles live under /build/ (immutable CDN caching, public/_headers); /assets/ stays public data.
  // Rapier's WASM is emitted as its own file by rapierWasmFile().
  build: {
    target: 'es2022',
    assetsDir: 'build',
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      input: ['index.html', 'preview/index.html'],
      output: {
        manualChunks: (id) => id.includes('/@dimforge/rapier3d-compat/') ? 'rapier' : undefined,
      },
    },
  },
});
