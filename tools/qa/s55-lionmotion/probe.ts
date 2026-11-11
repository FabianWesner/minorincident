import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, readSpec, stopServer, writeJson } from '../../scenelab/session';
const out = process.env.MOTION_OUT ?? 'test-results/s55-lionmotion/probe';
const allSpecies = ['lion', 'lioness', 'zebra', 'gorilla', 'elephant', 'flamingo', 'monkey'] as const;
const selected = process.env.MOTION_SPECIES;
if (selected && !allSpecies.some(species => species === selected)) throw new Error(`Unknown species ${selected}`);
const speciesList = selected ? allSpecies.filter(species => species === selected) : process.env.MOTION_CATS ? allSpecies.slice(0, 2) : allSpecies;
mkdirSync(out, { recursive: true });
const session = new SceneSession({ backend: process.env.MOTION_BACKEND === 'webgpu' ? 'webgpu' : 'webgl2', tier: process.env.MOTION_TIER === 'low' ? 'low' : 'high', viewport: { width: 960, height: 540 } });
try {
  await session.open();
  const spec = readSpec('specs/scenes/r36-lion-cats-run.json');
  spec.trace = true;
  spec.actors = speciesList.map((species, i) => ({ id: species, kind: 'animal' as const, species: species, at: [-15, i * 4] as [number, number], state: { walk: [[30, i * 4] as [number, number]], loop: true } }));
  spec.script = [];
  spec.camera = { mode: 'game', target: selected ? selected : [0, 0, process.env.MOTION_CATS ? 2 : 12], zoom: Number(process.env.MOTION_ZOOM ?? 1.5) };
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
    const batch = await session.page.evaluate(async (batchIndex) => {
      const game = (window.__SCENE__ as unknown as { game: import('../../../src/Game').Game }).game;
      const rows = [];
      for (let frame = 0; frame < 60; frame++) {
        await window.__SCENE__!.step(1);
        rows.push({ png: batchIndex === 10 && frame < 6 ? document.querySelector('canvas')!.toDataURL('image/png') : undefined, tick: game.world.tick, figures: game.view.crowdFigures().map(f => ({ id: f.id, clip: f.clip, phase: f.phase, joints: f.joints, forward: f.forward, feet: f.feet })) });
      }
      return rows;
    }, i);
    for (const [index, row] of batch.entries()) {
      if (row.png) writeFileSync(`${out}/strip-${index}.png`, Buffer.from(row.png.split(',')[1], 'base64'));
      delete row.png;
    }
    samples.push(...batch);
    writeJson(`${out}/frames.json`, samples);
    const metrics = await session.metrics();
    writeJson(`${out}/metrics.json`, metrics);
    if (i === 14) for (const [id, actor] of Object.entries(metrics.actors)) { if (actor.travelM < 1) throw new Error(`${id} did not move`); if (selected && actor.drawnFrames < 900) throw new Error(`${id} drawn only ${actor.drawnFrames}/900 frames`); }
    console.log(`recorded ${(i + 1) * 60} frames`);
  }
} finally { await session.close(); stopServer(); }
