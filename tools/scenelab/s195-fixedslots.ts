import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { SceneSession, stopServer } from './session';
import type { Game } from '../../src/Game';

const out = resolve('test-results/s195-fixedslots'); mkdirSync(out, { recursive: true });
const session = new SceneSession({ backend: 'webgl2', tier: 'high', viewport: { width: 1280, height: 720 } });
try {
  await session.open();
  const cells: { frame: number; jpeg: Buffer }[] = [];
  for (const level of ['L4', 'L8', 'L10'] as const) {
    await session.inspectLevel(level);
    await session.page.evaluate(async () => {
      const a = window.__SS__!; a.pause(); a.cheats.god(true); a.missions.begin(); a.camera.follow(); a.camera.zoom(1);
      await a.screenshotReady();
    });
    await session.screenshot(`${out}/${level}-start.png`);
    cells.push({ frame: cells.length, jpeg: await session.page.screenshot({ type: 'jpeg', quality: 82 }) });
    await session.page.evaluate(async () => {
      const g = (window.__SCENE__ as unknown as { game: Game }).game, p = g.world.entities.get(1)!;
      const id = g.world.missions!.def.id === 'L4' ? 'weapon.army-mg' : g.world.missions!.def.id === 'L8' ? 'weapon.rocket-launcher' : 'weapon.machete';
      g.world.pickups!.spawn('weapon', { x: p.transform.x, z: p.transform.z }, id);
      const pickup = [...g.world.entities.iterate()].find(e => e.pickup && 'actionId' in e.pickup && e.pickup.actionId === id)!;
      if (pickup.pickup && 'armed' in pickup.pickup) pickup.pickup.armed = true;
      g.world.update(); await window.__SS__!.screenshotReady();
    });
    await session.screenshot(`${out}/${level}-after-pickup.png`);
    cells.push({ frame: cells.length, jpeg: await session.page.screenshot({ type: 'jpeg', quality: 82 }) });
  }
  await session.makeSheet(cells, `${out}/rack-captures.jpg`, 640);
  if (session.errors.length) throw new Error(`Browser errors: ${session.errors.join('; ')}`);
} finally { await session.close(); stopServer(); }
