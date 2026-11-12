/** Matched original/current flamingo walk/run matrix, unchanged simulation and QA probes. Run under e2e-lock on 4958. */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import { SceneSession, readSpec, port, type Backend } from '../scenelab/session';
import { runSpec } from '../scenelab/run';
const baseline = 'a842fdd1', out = 'test-results/s57-matched';
if (port !== 4958) throw Error('S57 matched capture requires port 4958');
mkdirSync(out, { recursive: true });
const paths = execFileSync('git', ['diff', '--name-only', baseline, 'HEAD', '--', 'src/render'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
const originals = new Map(paths.map(path => [resolve(path), execFileSync('git', ['show', `${baseline}:${path}`], { encoding: 'utf8' })]));
const receipts: unknown[] = [];
for (const side of ['before', 'after']) {
  const server = await createServer({ configFile: resolve('vite.config.ts'), cacheDir: `/private/tmp/s57-matched-${side}`,
    plugins: side === 'before' ? [{ name: 's57-original-renderer', enforce: 'pre', load(id) { return originals.get(id.split('?')[0]); } }] : [],
    server: { host: '127.0.0.1', port, strictPort: true } });
  try {
    await server.listen();
    for (const backend of ['webgl2', 'webgpu'] as Backend[]) for (const tier of ['low', 'high'] as const) {
      const session = new SceneSession({ backend, tier, viewport: { width: 960, height: 540 } });
      try {
        await session.open();
        for (const mood of ['day', 'night']) {
          const spec = readSpec(`tests/scenes/catalog/foot-slide-flamingo-${mood}.json`);
          const dir = `${out}/${side}-${backend}-${tier}-${mood}`; mkdirSync(dir, { recursive: true });
          const result = await runSpec(session, spec, { out: dir, shots: [40, 46, 52, 58, 250, 256, 262, 268], sheet: 0 });
          receipts.push({ side, backend, tier, mood, result });
          writeFileSync(`${out}/receipts.json`, JSON.stringify({ baseline, current: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), paths, receipts }, null, 2));
          console.log(`${side} ${backend} ${tier} ${mood} complete`);
        }
      } finally { await session.close(); }
    }
  } finally { await server.close(); }
}
// Retain current contents for source-review receipts; browser overrides never alter files.
writeFileSync(`${out}/current-sources.json`, JSON.stringify(Object.fromEntries(paths.map(path => [path, readFileSync(path, 'utf8')])), null, 2));
