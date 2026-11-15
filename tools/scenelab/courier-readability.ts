import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, readSpec, stopServer, type Backend } from './session';
import { measureCourierShare } from './run';

// One browser at a time; invoke through e2e-lock.sh with a ten-minute pool lease.
const backend = (process.argv[2] ?? 'webgl2') as Backend;
const escaping = process.argv.includes('--escape');
const moving = process.argv.includes('--motion') || escaping;
if (!['webgl2', 'webgpu'].includes(backend)) throw new Error('Expected webgl2 or webgpu');
const out = `test-results/s121-courierread/repro-${backend}${escaping ? '-escape' : moving ? '-motion' : ''}`;
mkdirSync(out, { recursive: true });
const results: unknown[] = [];
try {
  for (const tier of ['high', 'low'] as const) {
    if (process.argv.includes('--high-only') && tier !== 'high') continue;
    const session = new SceneSession({ backend, tier });
    try {
      await session.open();
      for (const level of ['l4', 'l6']) for (const zoom of [1, 1.5]) {
        const spec = readSpec(`tests/scenes/catalog/courier-read-${level}-dense.json`);
        spec.camera = { mode: 'game', target: 'courier', zoom };
        if (moving) {
          for (const actor of spec.actors ?? []) {
            if (actor.kind === 'infected' && !escaping) actor.state = { chase: 'courier' };
            if (actor.kind === 'courier' && escaping && actor.at) actor.state = { moveTo: [actor.at[0] + 12, actor.at[1]], pace: 'run' };
          }
        }
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
        results.push({ id, backend: actual, health: 30, share: share.share, marker: state.render.courierMark, foreground: state.render.courierForeground });
        if (moving) {
          let previous = 1;
          for (const frame of escaping ? [30, 60, 180] : [30, 60]) {
            await session.step(frame - previous); previous = frame;
            const sample = await measureCourierShare(session);
            const hp = await session.page.evaluate(() => window.__SS__!.getState().player?.health.current);
            if (hp !== 30 || sample.share < .9 || session.errors.length) throw new Error(`Motion gate failed: ${id} f${frame}`);
            await session.screenshot(`${out}/${id}-f${frame}.png`);
            const foreground = await session.page.evaluate(() => window.__SS__!.getState().render.courierForeground);
            results.push({ id, frame, health: hp, share: sample.share, foreground });
          }
          const clipping = await session.clipping();
          writeFileSync(`${out}/${id}-clipping.json`, JSON.stringify(clipping, null, 2));
        }
        writeFileSync(`${out}/summary.json`, JSON.stringify(results, null, 2));
      }
    } finally { await session.close(); }
  }
} finally { stopServer(); }
