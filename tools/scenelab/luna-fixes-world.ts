import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Game } from '../../src/Game';
import { SceneSession, stopServer, writeJson } from './session';

const out = resolve(`test-results/luna-fixes-1101/world-${process.argv[2] ?? 'probe'}`);
mkdirSync(out, { recursive: true });
const session = new SceneSession({ backend: 'webgl2', tier: 'low' });
const receipts: unknown[] = [];
try {
  await session.open();
  const shot = async (name: string) => { await session.ready(); await session.page.screenshot({ path: `${out}/${name}.jpg`, type: 'jpeg', quality: 82 }); };
  for (const yaw of [0, 90, 180, 270]) {
    await session.load({ name: 'luna-apc-heading', ground: 'asphalt', time: 'L9-crossing', dof: false,
      actors: [{ id: 'courier', kind: 'courier', at: [0, 3] }],
      vehicles: [{ id: 'apc', asset: 'vehicle.military-apc', at: [0, 0], yaw, driven: true, floor: true }],
      camera: { mode: 'game', target: 'apc', zoom: .5 } });
    await session.step(60); await shot(`Q316-yaw${yaw}`);
    receipts.push({ yaw, render: await session.page.evaluate(() => window.__SS__!.getState().render.vehicles), feet: await session.page.evaluate(() => {
      const g = (window.__SCENE__ as unknown as { game: Game }).game;
      const v = g.view.labProbes().vehicles as unknown as { occupants: Map<number, import('three').Object3D> };
      const o = v.occupants.get(1)!;
      return ['hip', 'kneeL', 'kneeR', 'footL', 'footR'].map(name => { const b = o.getObjectByName(name); if (!b) return { name }; return { name, local: o.parent!.worldToLocal(b.getWorldPosition(b.position.clone())).toArray() }; });
    }) });
  }
  if (!process.env.LUNA_SEAT_ONLY) {
  await session.page.evaluate(async () => { const a = window.__SS__!; await a.loadLevel('L1', { seed: 1 }); a.missions.begin(); a.pause(); a.inspect.enable(false); a.camera.follow(); a.camera.zoom(.5); });
  for (const [name, x, z] of [['bags', -18, -49.25], ['crates', 0, -49.25], ['chair', -39, -16.25]] as const) {
    await session.page.evaluate(([x, z]) => window.__SS__!.teleport('player', { x: x - 2, z }), [x, z]);
    await shot(`Q319-${name}-start`);
    await session.page.keyboard.down('KeyS'); await session.page.keyboard.down('KeyD');
    const path = [];
    for (let i = 0; i < 15; i++) { await session.page.evaluate(() => window.__SS__!.step(6)); path.push(await session.page.evaluate(() => window.__SS__!.getEntity(1)!.transform)); }
    await session.page.keyboard.up('KeyS'); await session.page.keyboard.up('KeyD');
    await shot(`Q319-${name}-end`);
    receipts.push({ name, x, z, path });
  }
  await session.page.evaluate(async () => { const a = window.__SS__!; await a.loadLevel('L3', { seed: 1 }); a.missions.begin(); a.pause(); a.camera.follow(); a.camera.zoom(.5); });
  await shot('Q317-L3-start');
  receipts.push({ scene: 'L3', state: await session.page.evaluate(() => { const g = (window.__SCENE__ as unknown as { game: Game }).game; return { player: g.world.entities.get(1)!.transform, actors: [...g.world.entities.iterate()].filter(e => !e.hidden && (e.infected || e.civilian)).map(e => ({ id: e.id, at: e.transform, hp: e.health.current, corpse: !!e.corpse })) }; }) });
  }
  writeJson(`${out}/receipts.json`, { receipts, errors: session.errors });
} finally { await session.close(); stopServer(); }
