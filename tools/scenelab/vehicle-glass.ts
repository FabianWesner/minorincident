/** PKG-10/11/12 before/after review, run under tools/e2e-lock.sh. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, origin, stopServer } from './session';
import { vehicles } from '../../src/data/vehicles';

const out = process.argv[2] ?? 'test-results/vehicle-glass/after';
const ids = (process.argv[3] ?? 'sedan-red,suv-dark,pickup-red,police-sedan,ambulance,fire-engine,school-bus').split(',');
const session = new SceneSession({ tier: process.env.SCENE_TIER === 'low' ? 'low' : 'high' });
const metrics: unknown[] = [];
mkdirSync(out, { recursive: true });
try {
  await session.open();
  for (const id of ids) {
    console.log(`Capturing ${id}`);
    const cells: { frame: number; jpeg: Buffer }[] = [];
    for (const mode of ['game', 'close'] as const) {
      await session.load({ name: id, ground: 'asphalt', size: 24, time: 'L2',
        vehicles: [{ id: 'car', asset: vehicles.find(v => v.asset === `veh.${id}`)!.id, at: [0, 0] }],
        camera: mode === 'game' ? { mode, target: [0, 1, 0] } : { mode, target: [1, 1.6, 0], radius: 9, azimuth: 45 },
        expect: { consoleErrors: 0 } });
      await session.step(60); await session.ready();
      // Settle asynchronous tier swaps before comparing images/counters.
      await session.ready();
      const renderPerf = await session.page.evaluate(() => window.__SS__!.perf());
      await session.screenshot(`${out}/${id}-${mode}.png`);
      cells.push({ frame: mode === 'game' ? 0 : 1, jpeg: await session.snapshot() });
      metrics.push({ id, mode, renderPerf, metrics: await session.metrics(), errors: session.errors });
    }
    await session.makeSheet(cells, `${out}/${id}-scene.jpg`, 640);
    await session.page.goto(`${origin}/preview/?asset=veh.${id}&test=1&renderer=webgl&production=1&inspection=1`);
    await session.page.waitForFunction(() => !!window.__ASSET__);
    await session.page.evaluate(() => window.__ASSET__!.ready);
    await session.page.locator('#toolbar').evaluate(el => { el.style.display = 'none'; });
    const lods: { frame: number; jpeg: Buffer }[] = [];
    for (const angle of [45, 225]) for (const quality of ['high', 'lod1', 'lod2'] as const) {
      await session.page.evaluate(async ({ quality, angle }) => { await window.__ASSET__!.inspectionView!(quality, angle); }, { quality, angle });
      const info = await session.page.evaluate(() => window.__ASSET__!.info());
      if (info.placeholder) throw new Error(`${id}/${quality}: placeholder`);
      metrics.push({ id, quality, angle, info });
      lods.push({ frame: lods.length, jpeg: await session.page.screenshot({ type: 'jpeg', quality: 85 }) });
    }
    await session.makeSheet(lods, `${out}/${id}-lods.jpg`, 480);
  }
  writeFileSync(`${out}/${process.argv[3] ? 'metrics-' + process.argv[3] : 'metrics'}.json`, JSON.stringify(metrics, null, 2) + '\n');
  if (session.errors.length) throw new Error(session.errors.join('\n'));
} finally { await session.close(); stopServer(); }
