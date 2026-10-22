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
  worker: { format: 'es' },
  build: {
    target: 'es2022',
    assetsDir: 'build',
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      // preview/lighting-spike.html is a dev/QA page: only built with BUILD_SPIKES=1 (tests/visual/e25-spike.spec.ts), never in the production dist.
      input: ['index.html', 'preview/index.html', ...(process.env.BUILD_SPIKES ? ['preview/lighting-spike.html'] : [])],
      output: {
        manualChunks: (id) => id.includes('/@dimforge/rapier3d-compat/') ? 'rapier' : id.endsWith('/src/data/lightAnchors.json') ? 'light-anchors' : id.endsWith('/src/assets/wreckRoofs.ts') ? 'wreck-roofs' : id.endsWith('/src/render/characters/library.json') || id.endsWith('/src/render/characters/library.skin.json') ? 'character-clips' : undefined,
      },
    },
  },
});
