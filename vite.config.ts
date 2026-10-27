import { defineConfig } from 'vite';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { assetVersionsDefine, rapierWasmFile } from './tools/build/load-plugins';
let buildCommit = 'unknown';
try { buildCommit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { /* Source archives may not include Git metadata. */ }
let cacheDir = '.vite-cache';
try {
  const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { encoding: 'utf8' }).trim();
  // Vite 6 optimizer metadata hashes config.root and embeds absolute package paths.
  // Keep optimizer writers isolated; the dependency store and immutable dist are shared.
  const cacheKey = createHash('sha256').update(readFileSync('package-lock.json')).update(readFileSync('vite.config.ts')).update(resolve('.')).digest('hex').slice(0, 20);
  cacheDir = resolve(process.env.MI_WORKTREE_CACHE ?? dirname(common) + '/.mi-worktree-cache', 'vite', cacheKey);
} catch { /* Source archives use the local cache. */ }
export default defineConfig({
  define: { __BUILD_COMMIT__: JSON.stringify(buildCommit) },
  cacheDir,
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
