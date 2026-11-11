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
    game.world.events.on('sim.tick', () => { for (const e of game.world.entities.iterate()) if (e.civilian?.zooAnimal) { const speed = e.civilian.l1!.walkSpeed ?? 1; e.transform.x += speed / 60; e.motion = { velocity: { x: speed, z: 0 }, speed, moving: true, distance: (e.motion?.distance ?? 0) + speed / 60 }; } }, 1000);
    for (const e of game.world.entities.iterate()) if (e.civilian?.zooAnimal) {
      e.civilian.waypoints = [{ x: 40, z: e.transform.z }]; e.civilian.waypoint = 0; e.civilian.pauseUntil = 0;
      e.civilian.l1!.walkSpeed = 1;
    }
  });
  const samples: unknown[] = [];
  for (let i = 0; i < 15; i++) {
    if (i === 10) await session.page.evaluate(() => {
      const game = (window.__SCENE__ as unknown as { game: import('../../../src/Game').Game }).game;
      for (const e of game.world.entities.iterate()) if (e.civilian?.zooAnimal) e.civilian.l1!.walkSpeed = 3.2;
    });
    samples.push(...await session.page.evaluate(async () => {
      const game = (window.__SCENE__ as unknown as { game: import('../../../src/Game').Game }).game;
      const rows = [];
      for (let frame = 0; frame < 60; frame++) {
        await window.__SCENE__!.step(1);
        rows.push({ tick: game.world.tick, figures: game.view.crowdFigures().map(f => ({ id: f.id, clip: f.clip, phase: f.phase, joints: f.joints, forward: f.forward, feet: f.feet })) });
      }
      return rows;
    }));
    writeJson(`${out}/frames.json`, samples);
    const metrics = await session.metrics();
    writeJson(`${out}/metrics.json`, metrics);
    if (i === 14) for (const [id, actor] of Object.entries(metrics.actors)) { if (actor.travelM < 1) throw new Error(`${id} did not move`); }
    console.log(`recorded ${(i + 1) * 60} frames`);
  }
} finally { await session.close(); stopServer(); }
