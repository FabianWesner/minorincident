import type { SceneSpec } from '../../src/debug/scenelab/spec';
import type { Game } from '../../src/Game';
import { SceneSession, stopServer, writeJson } from './session';

/** Q-221: the QA tree at (47.52,-17.36), between the shortcut and its detour. Real W-key drive. */
const out = process.argv[2] ?? 'test-results/polish-26/l9-before';
const session = new SceneSession({ backend: 'webgl2', tier: 'high' });
const spec: SceneSpec = {
  name: 'polish-26-l9-tree', ground: 'district', time: 'L9-crossing', tier: 5,
  layout: { district: 'D-CROSSING', bbox: [[20, -42], [75, 5]] },
  actors: [{ id: 'courier', kind: 'courier', at: [40, -17.36], god: true }],
  vehicles: [{ id: 'apc', asset: 'vehicle.military-apc', at: [42, -17.36], yaw: 0, floor: true }],
  camera: { mode: 'follow', actor: 'apc', zoom: 1.5 },
};
try {
  await session.open(); await session.load(spec);
  await session.page.evaluate(() => {
    const g = (window.__SCENE__ as unknown as { game: Game }).game;
    const car = g.world.entities.values().find(e => e.archetype === 'vehicle.military-apc')!;
    g.world.vehicles!.active = car.id; car.vehicle!.driver = 1; g.world.vehicles!.rebuild();
    window.__SS__!.camera.follow(); window.__SS__!.camera.zoom(1.5);
  });
  const trace = [];
  await session.page.keyboard.down('w');
  for (let frame = 0; frame <= 150; frame += 5) {
    const sample = await session.page.evaluate(() => {
      const g = (window.__SCENE__ as unknown as { game: Game }).game;
      const car = g.world.entities.values().find(e => e.archetype === 'vehicle.military-apc')!;
      return { tick: g.world.tick, position: { ...car.transform }, health: car.health.current, active: g.world.vehicles!.active };
    });
    trace.push(sample);
    if ([0, 60, 90, 120, 150].includes(frame)) {
      await session.page.evaluate(() => window.__SS__!.screenshotReady()); await session.screenshot(`${out}/frame-${frame}.png`);
    }
    if (frame < 150) await session.page.evaluate(() => window.__SS__!.step(5));
  }
  await session.page.keyboard.up('w');
  writeJson(`${out}/trace.json`, { trace, consoleErrors: session.errors }); console.log(JSON.stringify(trace.at(-1)));
} finally { await session.close(); stopServer(); }
