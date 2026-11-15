import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, readSpec, stopServer, type Backend } from './session';
import { measureCourierShare } from './run';

// One browser at a time; invoke through e2e-lock.sh with a ten-minute pool lease.
const backend = (process.argv[2] ?? 'webgl2') as Backend;
if (!['webgl2', 'webgpu'].includes(backend)) throw new Error('Expected webgl2 or webgpu');
const out = `test-results/s121-courierread/repro-${backend}`;
mkdirSync(out, { recursive: true });
const results: unknown[] = [];
try {
  for (const tier of ['high', 'low'] as const) {
    const session = new SceneSession({ backend, tier });
    try {
      await session.open();
      for (const level of ['l4', 'l6']) for (const zoom of [1, 1.5]) {
        const spec = readSpec(`tests/scenes/catalog/courier-read-${level}-dense.json`);
        spec.camera = { mode: 'game', target: 'courier', zoom };
        await session.load(spec);
        await session.page.evaluate(() => window.__SS__!.survivor.damage(70));
        await session.step(1);
        const state = await session.page.evaluate(() => window.__SS__!.getState());
        if (state.player?.health.current !== 30) throw new Error('Expected 30 HP');
        const metrics = await session.metrics();
        const actual = metrics.backend;
        if (actual !== (backend === 'webgl2' ? 'webgl' : 'webgpu')) throw new Error(`Backend mismatch: ${actual}`);
        if (state.render.quality !== tier) throw new Error('Quality mismatch');
        const share = await measureCourierShare(session);
        if (share.share < .9 || session.errors.length) throw new Error(`Visibility/console gate failed: ${level}`);
        const id = `${level}-${tier}-z${zoom}`;
        await session.screenshot(`${out}/${id}.png`);
        results.push({ id, backend: actual, health: 30, share: share.share, foreground: state.render.courierForeground });
        writeFileSync(`${out}/summary.json`, JSON.stringify(results, null, 2));
      }
    } finally { await session.close(); }
  }
} finally { stopServer(); }
