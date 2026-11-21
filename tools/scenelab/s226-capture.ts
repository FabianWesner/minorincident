import { SceneSession, readSpec, stopServer } from './session';
import type { Game } from '../../src/Game';
import { mkdirSync } from 'node:fs';
const out = 'test-results/s226-apc'; mkdirSync(out, { recursive: true });
const session = new SceneSession({ tier: 'high', viewport: { width: 1600, height: 900 }, nativeFrameTiming: true });
try {
  await session.open();
  const spec = readSpec('tests/scenes/l9-apc/ram.json');
  spec.actors = spec.actors!.filter(a => a.id === 'courier');
  spec.props = [{ id: 'bin', asset: 'prop.trash-bin', at: [9, -.8] }, { id: 'recycle', asset: 'prop.recycling-bin', at: [10, .8] }, { id: 'cone', asset: 'prop.traffic-cone', at: [11, 0] }];
  delete spec.expect; await session.load(spec);
  await session.page.evaluate(() => { const w = (window.__SCENE__ as unknown as { game: Game }).game.world; const car = [...w.vehicles!.cars.values()][0]; car.entity.vehicle!.floor = true; w.vehicles!.obstacles.spawn('barricade', { x: 12, z: 0 }); });
  let previous = 0;
  for (const frame of [79, 120, 140, 160, 190, 220, 260, 300]) { await session.step(frame - previous); previous = frame; await session.ready(); await session.screenshot(`${out}/${frame}.png`); }
} finally { await session.close(); stopServer(); }
