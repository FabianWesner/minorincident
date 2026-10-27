import { defineConfig } from 'vite';
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { assetVersionsDefine, rapierWasmFile } from './tools/build/load-plugins';
let buildCommit = 'unknown';
try { buildCommit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { /* Source archives may not include Git metadata. */ }
const qaHooks = process.env.NODE_ENV !== 'production' || process.env.BRANCH === 'qa' || process.env.VITE_QA_HOOKS === '1';
function stripQaPublicFiles() {
  let outDir = 'dist';
  return { name: 'strip-qa-public-files', apply: 'build' as const, configResolved(config: { build: { outDir: string } }) { outDir = config.build.outDir; }, closeBundle() { rmSync(resolve(outDir, 'perf-device.html'), { force: true }); rmSync(resolve(outDir, 'assets/motionlab'), { recursive: true, force: true }); } };
}
let cacheDir = '.vite-cache';
try {
  const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { encoding: 'utf8' }).trim();
  // Vite 6 optimizer metadata hashes config.root and embeds absolute package paths.
  // Keep optimizer writers isolated; the dependency store and immutable dist are shared.
  const cacheKey = createHash('sha256').update(readFileSync('package-lock.json')).update(readFileSync('vite.config.ts')).update(resolve('.')).digest('hex').slice(0, 20);
  cacheDir = resolve(process.env.MI_WORKTREE_CACHE ?? dirname(common) + '/.mi-worktree-cache', 'vite', cacheKey);
} catch { /* Source archives use the local cache. */ }
export default defineConfig({
  define: { __BUILD_COMMIT__: JSON.stringify(buildCommit), __QA_HOOKS__: JSON.stringify(qaHooks) },
  cacheDir,
  plugins: [rapierWasmFile(), assetVersionsDefine(), ...(!qaHooks ? [stripQaPublicFiles()] : [])],
  resolve: { dedupe: ['three'] },
  optimizeDeps: { entries: ['index.html', 'preview/*.html'] },
  server: { host: '127.0.0.1', port: 3300, strictPort: true },
  // Hashed bundles live under /build/ (immutable CDN caching, public/_headers); /assets/ stays public data.
  // Rapier's WASM is emitted as its own file by rapierWasmFile().
  worker: { format: 'es' },
  build: {
    target: 'es2022',
    assetsDir: 'build',
    // The synchronous game entry is ~3.2 MB raw and ~0.9 MB gzip; splitting the cyclic data/assets/render/sim graph creates rollup cycles.
    chunkSizeWarningLimit: 3200,
    rollupOptions: {
      // preview/lighting-spike.html is a dev/QA page: only built with BUILD_SPIKES=1 (tests/visual/e25-spike.spec.ts), never in the production dist.
      input: ['index.html', ...(qaHooks ? ['preview/index.html'] : []), ...(qaHooks && process.env.BUILD_SPIKES === '1' ? ['preview/lighting-spike.html'] : [])],
      output: {
        manualChunks: (id) => id.endsWith('/three/build/three.webgpu.js') ? 'three-webgpu' : id.endsWith('/three/build/three.core.js') ? 'three-core' : id.includes('/@dimforge/rapier3d-compat/') ? 'rapier' : id.endsWith('/src/data/lightAnchors.json') ? 'light-anchors' : id.endsWith('/src/assets/wreckRoofs.ts') ? 'wreck-roofs' : id.endsWith('/src/render/characters/library.json') || id.endsWith('/src/render/characters/library.skin.json') ? 'character-clips' : undefined,
      },
    },
  },
});
