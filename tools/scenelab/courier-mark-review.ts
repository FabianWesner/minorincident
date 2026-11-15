/** One pooled browser; matched marker-disabled/enabled captures and structural draw counts. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, readSpec, stopServer } from './session';
const corpses = process.argv.includes('--corpses');
const timing = process.argv.includes('--perf');
const out = `test-results/s133-couriermark/review${corpses ? '-corpses' : ''}${process.argv.includes('--webgpu') ? '-webgpu' : ''}${timing ? '-perf' : ''}`;
mkdirSync(out, { recursive: true });
const session = new SceneSession({ backend: process.argv.includes('--webgpu') ? 'webgpu' : 'webgl2', tier: 'high', nativeFrameTiming: timing });
const rows: unknown[] = [];
try {
  await session.open();
  for (const level of ['l4', 'l6']) {
    const spec = readSpec(`tests/scenes/catalog/courier-read-${level}-dense.json`);
    spec.camera = { mode: 'game', target: 'courier', zoom: 1 };
    for (const actor of spec.actors ?? []) if (actor.kind === 'infected') actor.state = { chase: 'courier' };
    await session.load(spec); await session.step(60);
    if (corpses) { await session.page.evaluate(() => { for (let i = 0; i < 16; i++) window.__SCENE__!.command(`infected-${i}`, { corpse: true, ageTicks: 180 }); }); await session.step(1); }
    for (const enabled of [false, true]) {
      await session.page.evaluate(on => {
        // Debug fixture owns the game; change only the marker's geometry submission.
        const lab = window.__SCENE__ as unknown as { game: { view: { scene: import('three').Scene } } };
        lab.game.view.scene.traverse(node => {
          const mesh = node as import('three').Mesh;
          if (mesh.isMesh && !Array.isArray(mesh.material) && mesh.material.name === 'courier-ground-mark') mesh.geometry.setDrawRange(0, on ? Infinity : 0);
        });
      }, enabled);
      await session.ready();
      await session.screenshot(`${out}/${level}-${enabled ? 'after' : 'before'}.png`);
      const timings = timing ? await session.page.evaluate(async () => {
        const lab = window.__SCENE__ as unknown as { game: { view: { update(alpha: number): void } } };
        const cpu: number[] = [], intervals: number[] = []; let previous = 0;
        for (let i = 0; i < 780; i++) {
          const now = await new Promise<number>(resolve => requestAnimationFrame(resolve));
          const start = performance.now(); lab.game.view.update(1); const cost = performance.now() - start;
          if (i >= 180) { cpu.push(cost); intervals.push(now - previous); } previous = now;
        }
        cpu.sort((a, b) => a - b); intervals.sort((a, b) => a - b);
        return { samples: cpu.length, cpuMs: { median: cpu[300], p95: cpu[570] }, frameMs: { median: intervals[300], p95: intervals[570] } };
      }) : null;
      rows.push({ level, enabled, timings, perf: await session.page.evaluate(() => window.__SS__!.perf()) });
    }
  }
  writeFileSync(`${out}/metrics.json`, JSON.stringify({ rows, errors: session.errors }, null, 2));
} finally { await session.close(); stopServer(); }
