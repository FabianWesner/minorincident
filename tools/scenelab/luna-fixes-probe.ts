import { resolve } from 'node:path';
import type { Game } from '../../src/Game';
import type { ActorSpec, SceneSpec } from '../../src/debug/scenelab/spec';
import { SceneSession, stopServer, writeJson } from './session';
import { measureCourierShare } from './run';

const out = resolve('test-results/luna-fixes-1101/probe');
const session = new SceneSession({ backend: 'webgl2', tier: 'low', viewport: { width: 1280, height: 720 } });
const receipts: unknown[] = [];
try {
  await session.open();
  if (!process.env.LUNA_CELLAR_ONLY) {
  const fence: SceneSpec = { name: 'luna-alley', ground: 'district', time: 'L1', tier: 0,
    layout: { district: 'D-GROVE', bbox: [[-55, -23], [-31, -8]] },
    actors: [{ id: 'courier', kind: 'courier', at: [-44, -15.5] }, { id: 'corgi', kind: 'corgi', at: [-43, -15.5] }],
    camera: { mode: 'follow', actor: 'courier', zoom: .5 } };
  await session.load(fence); await session.screenshot(`${out}/Q314-alley.png`);
  receipts.push({ scene: 'fence', share: await measureCourierShare(session), metrics: await session.metrics() });
  console.log('fence captured');

  const cops: ActorSpec[] = Array.from({ length: 80 }, (_, i) => ({ id: `cop-${i}`, kind: 'pedestrian', at: [(i % 10 - 4.5) * .48, (Math.floor(i / 10) - 3.5) * .48],
    look: { model: 'npc.police-officer', role: 'officer', handProp: null }, state: 'idle' }));
  await session.load({ name: 'luna-crowd', ground: 'asphalt', time: 'L3', actors: [{ id: 'courier', kind: 'courier', at: [0, 0] }, ...cops],
    camera: { mode: 'follow', actor: 'courier', zoom: .5 } });
  await session.screenshot(`${out}/Q318-crowd.png`);
  receipts.push({ scene: 'crowd', share: await measureCourierShare(session), foreground: await session.page.evaluate(() => window.__SS__!.getState().render.courierForeground) });
  console.log('crowd captured');

  await session.load({ name: 'luna-apc', ground: 'asphalt', time: 'L9-crossing', dof: false,
    actors: [{ id: 'courier', kind: 'courier', at: [0, 3], look: { model: 'female' } }],
    vehicles: [{ id: 'apc', asset: 'vehicle.military-apc', at: [0, 0], driven: true }], camera: { mode: 'game', target: 'apc', zoom: 1.5 } });
  await session.step(2); await session.ready();
  await session.screenshot(`${out}/Q316-apc-z15.png`);
  await session.page.evaluate(() => window.__SCENE__!.setCamera({ mode: 'game', target: 'apc', zoom: .5 }));
  await session.screenshot(`${out}/Q316-apc-z05.png`);
  await session.page.evaluate(() => window.__SCENE__!.setCamera({ mode: 'close', target: [.7, 1.3, .5], radius: 5, azimuth: 45 }));
  await session.screenshot(`${out}/Q316-apc-close.png`);
  receipts.push({ scene: 'apc', vehicles: await session.page.evaluate(() => window.__SS__!.getState().render.vehicles) });
  console.log('APC captured');
  }

  await session.page.evaluate(async () => { const a = window.__SS__!; await a.loadLevel('L5', { seed: 1 }); a.missions.begin(); a.pause(); a.inspect.enable(false); a.camera.follow(); a.camera.zoom(.5); });
  const start = await session.page.evaluate(() => { const g = (window.__SCENE__ as unknown as { game: Game }).game; return { player: { ...g.world.entities.get(1)!.transform }, anchor: g.world.missions!.def.anchors['l5-brace'], phase: g.world.missions!.state.l5!.phase }; });
  await session.screenshot(`${out}/Q320-start.png`);
  const target = start.anchor;
  await session.page.keyboard.down('KeyA'); await session.page.keyboard.down('KeyS');
  const path = [];
  for (let i = 0; i < 9; i++) { await session.page.evaluate(() => window.__SS__!.step(6)); path.push(await session.page.evaluate(() => window.__SS__!.getEntity(1)!.transform)); }
  await session.page.keyboard.up('KeyA'); await session.page.keyboard.up('KeyS');
  await session.screenshot(`${out}/Q320-at-ring.png`);
  await session.page.keyboard.down('KeyE'); await session.page.evaluate(() => window.__SS__!.step(180)); await session.page.keyboard.up('KeyE');
  await session.screenshot(`${out}/Q320-interacted.png`);
  receipts.push({ scene: 'cellar-input', start, target, path, end: await session.page.evaluate(() => { const g = (window.__SCENE__ as unknown as { game: Game }).game; return { player: { ...g.world.entities.get(1)!.transform }, phase: g.world.missions!.state.l5!.phase, step: g.world.missions!.state.steps.emerge }; }) });
  console.log('cellar input complete');
  writeJson(`${out}/receipts.json`, { receipts, errors: session.errors });
} finally { await session.close(); stopServer(); }
