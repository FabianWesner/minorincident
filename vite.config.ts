import { defineConfig } from 'vite';
import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { assetVersionsDefine, rapierWasmFile } from './tools/build/load-plugins';
let buildCommit = 'unknown';
try { buildCommit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { /* Source archives may not include Git metadata. */ }
const qaHooks = process.env.NODE_ENV !== 'production' || process.env.BRANCH === 'qa' || process.env.VITE_QA_HOOKS === '1';
function stripQaPublicFiles() {
  let outDir = 'dist';
  return { name: 'strip-qa-public-files', apply: 'build' as const, configResolved(config: { build: { outDir: string } }) { outDir = config.build.outDir; }, closeBundle() { rmSync(resolve(outDir, 'perf-device.html'), { force: true }); rmSync(resolve(outDir, 'assets/motionlab'), { recursive: true, force: true }); } };
}
export default defineConfig({
  define: { __BUILD_COMMIT__: JSON.stringify(buildCommit), __QA_HOOKS__: JSON.stringify(qaHooks) },
  cacheDir: '.vite-cache',
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
