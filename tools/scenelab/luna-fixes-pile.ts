import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Game } from '../../src/Game';
import { SceneSession, stopServer, writeJson } from './session';

const out = resolve('test-results/luna-fixes-1101/pile');
mkdirSync(out, { recursive: true });
const session = new SceneSession({ backend: 'webgl2', tier: 'low' });
const receipts: unknown[] = [];
try {
  await session.open();
  await session.page.evaluate(async () => { const a = window.__SS__!; await a.loadLevel('L3', { seed: 1 }); a.missions.begin(); a.missions.completeObjective('armory'); a.pause(); a.teleport('player', { x: -141, z: -16 }); a.camera.follow(); a.camera.zoom(.5); });
  for (let i = 0; i < 60; i++) {
    await session.page.evaluate(() => window.__SS__!.step(60));
    if (i % 10 === 9) {
      await session.ready();
      await session.page.screenshot({ path: `${out}/Q317-${i + 1}s.jpg`, type: 'jpeg', quality: 82 });
      receipts.push(await session.page.evaluate(() => { const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
        return { tick: g.world.tick, audit: a.debug.corpseLayout(), player: g.world.entities.get(1)!.transform,
          elevated: [...g.world.entities.iterate()].filter(e => !e.hidden && (e.civilian || e.infected) && e.transform.y > 1.2).map(e => ({ id: e.id, at: e.transform, hp: e.health.current, corpse: !!e.corpse, infected: e.infected, civilian: e.civilian })) }; }));
      console.log(`L3 ${i + 1}s`);
    }
  }
  writeJson(`${out}/receipts.json`, { receipts, errors: session.errors });
} finally { await session.close(); stopServer(); }
