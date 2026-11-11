import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer, writeJson } from '../../scenelab/session';
import { readFixture } from '../fixture-io';
import { loadFixtureInPage } from '../load-fixture';
const out = process.env.MOTION_OUT ?? 'test-results/s55-lionmotion/l8-after';
mkdirSync(out, { recursive: true });
const session = new SceneSession({ backend: process.env.MOTION_BACKEND === 'webgpu' ? 'webgpu' : 'webgl2', tier: process.env.MOTION_TIER === 'low' ? 'low' : 'high', viewport: { width: 1280, height: 720 } });
try {
  await session.open();
  console.log(await loadFixtureInPage(session.page, readFixture('tests/fixtures/saves/qa/l8-before-lion.json.gz')));
  await session.page.evaluate(() => { window.__SS__!.debug.figureJoints(true); window.__SS__!.cheats.god(true); window.__SS__!.camera.cinematic({ position: [-28, 18, 3], target: [-45, 0, -14] }, true); });
  if (process.env.MOTION_FIXTURE_ROUTE) await session.page.evaluate(() => {
    const game = (window.__SCENE__ as unknown as { game: import('../../../src/Game').Game }).game;
    const started = game.world.tick;
    const cats = [...game.world.entities.iterate()].filter(e => /lion/.test(e.civilian?.zooAnimal ?? e.archetype)).map(e => ({ entity: e, x: e.transform.x, z: -42, distance: e.motion?.distance ?? 0 }));
    game.world.events.on('sim.tick', () => {
      const seconds = (game.world.tick - started) / 60, speed = seconds <= 10 ? 1 : 3.2, distance = Math.min(10, seconds) + Math.max(0, seconds - 10) * 3.2;
      for (const cat of cats) {
        cat.entity.transform.x = cat.x - distance; cat.entity.transform.z = cat.z; cat.entity.transform.y = .7 + (game.world.districts?.pavingHeight(cat.entity.transform.x, cat.z) ?? 0); cat.entity.transform.yaw = Math.PI;
        cat.entity.motion = { velocity: { x: -speed, z: 0 }, speed, moving: true, distance: cat.distance + distance };
      }
      const x = cats[0].entity.transform.x;
      game.view.view.cinematic({ position: [x + 17, 18, cats[0].z + 17], target: [x, 0, cats[0].z] }, true);
    }, 1000);
  });
  writeJson(`${out}/config.json`, { requestedBackend: process.env.MOTION_BACKEND ?? 'webgl2', tier: process.env.MOTION_TIER ?? 'high', actualBackend: await session.page.evaluate(() => (window.__SCENE__ as unknown as { game: import('../../../src/Game').Game }).game.view.renderer.selectedBackend), movement: process.env.MOTION_FIXTURE_ROUTE ? 'test-only route: 10 s at 1 m/s + 5 s at 3.2 m/s; gameplay stats unchanged' : 'natural fixture simulation, no speed overrides' });
  const rows: unknown[] = [];
  for (let batch = 0; batch < 15; batch++) {
    const batchRows = await session.page.evaluate(async (batchIndex) => {
      const game = (window.__SCENE__ as unknown as { game: import('../../../src/Game').Game }).game;
      const samples = [];
      for (let frame = 0; frame < 60; frame++) {
        await window.__SS__!.step(1);
        if (batchIndex === 2 && frame >= 54 || batchIndex === 3 && frame < 6) await window.__SS__!.screenshotReady();
        let redraw: { tick: number; maxJointDeltaM: number } | undefined;
        if (batchIndex === 2 && frame === 54) {
          const before = structuredClone(game.view.crowdFigures());
          for (let draw = 0; draw < 5; draw++) game.view.update(1);
          let maxJointDeltaM = 0;
          for (const current of game.view.crowdFigures()) {
            const old = before.find(figure => figure.id === current.id);
            for (const [name, point] of Object.entries(current.joints ?? {})) if (old?.joints?.[name]) maxJointDeltaM = Math.max(maxJointDeltaM, Math.hypot(...point.map((value, axis) => value - old.joints![name][axis])));
          }
          redraw = { tick: game.world.tick, maxJointDeltaM };
        }
        const ids = new Set([...game.world.entities.iterate()].filter(e => /lion/.test(e.civilian?.zooAnimal ?? e.archetype)).map(e => e.id));
        const crowd = (game.view as unknown as { crowd?: { batches: Map<string, { count: number; locomotion: { presentation: { frame: number } } }> } }).crowd;
        const atlas = [...(crowd?.batches ?? [])].filter(([key, batch]) => /lion/.test(key) && batch.count > 0).map(([key, batch]) => ({ key, frameIndex: batch.locomotion.presentation.frame }));
        samples.push({ atlas, redraw, png: (batchIndex === 2 && frame >= 54 || batchIndex === 3 && frame < 6) ? document.querySelector('canvas')!.toDataURL('image/png') : undefined, tick: game.world.tick, sim: [...ids].map(id => ({ id, transform: { ...game.world.entities.get(id)!.transform }, motion: structuredClone(game.world.entities.get(id)!.motion) })), figures: game.view.crowdFigures().filter(f => ids.has(f.id)) });
      }
      return samples;
    }, batch);
    for (const [index, sample] of batchRows.entries()) { if (sample.png) writeFileSync(`${out}/frame-${batch * 60 + index}.png`, Buffer.from(sample.png.split(',')[1], 'base64')); delete sample.png; }
    rows.push(...batchRows);
    writeJson(`${out}/frames.json`, rows);
    console.log(`fixture ${rows.length} frames`);
  }
  await session.screenshot(`${out}/scene.png`);
} finally { await session.close(); stopServer(); }
