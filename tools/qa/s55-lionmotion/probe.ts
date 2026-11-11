import { mkdirSync } from 'node:fs';
import { SceneSession, readSpec, stopServer, writeJson } from '../../scenelab/session';
const out = 'test-results/s55-lionmotion/probe';
mkdirSync(out, { recursive: true });
const session = new SceneSession({ backend: 'webgl2', tier: 'high', viewport: { width: 960, height: 540 } });
try {
  await session.open();
  const spec = readSpec('specs/scenes/r36-lion-cats-run.json');
  spec.trace = true;
  spec.actors = ['lion', 'lioness'].map((species, i) => ({ id: species, kind: 'animal' as const, species: species as 'lion' | 'lioness', at: [-15, i * 4] as [number, number], state: { walk: [[30, i * 4] as [number, number]], loop: true } }));
  spec.script = ['lion', 'lioness'].map((actor, i) => ({ frame: 600, actor, do: { run: [[40, i * 4] as [number, number]], loop: true } }));
  await session.load(spec);
  await session.page.evaluate(() => {
    const game = (window.__SCENE__ as unknown as { game: import('../../../src/Game').Game }).game;
    game.world.events.on('sim.tick', () => { for (const e of game.world.entities.iterate()) if (e.civilian?.zooAnimal) e.transform.x += (e.civilian.l1!.walkSpeed ?? 1) / 60; }, 0);
    for (const e of game.world.entities.iterate()) if (e.civilian?.zooAnimal) {
      e.civilian.waypoints = [{ x: 40, z: e.transform.z }]; e.civilian.waypoint = 0; e.civilian.pauseUntil = 0;
      e.civilian.l1!.walkSpeed = 1;
    }
  });
  for (let i = 0; i < 15; i++) {
    if (i === 10) await session.page.evaluate(() => {
      const game = (window.__SCENE__ as unknown as { game: import('../../../src/Game').Game }).game;
      for (const e of game.world.entities.iterate()) if (e.civilian?.zooAnimal) e.civilian.l1!.walkSpeed = 3.2;
    });
    await session.step(60);
    const metrics = await session.metrics();
    writeJson(`${out}/metrics.json`, metrics);
    if (i === 14) for (const [id, actor] of Object.entries(metrics.actors)) { if (actor.travelM < 1) throw new Error(`${id} did not move`); }
    console.log(`recorded ${(i + 1) * 60} frames`);
  }
} finally { await session.close(); stopServer(); }
