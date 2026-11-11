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
  const rows: unknown[] = [];
  for (let batch = 0; batch < 15; batch++) {
    const batchRows = await session.page.evaluate(async (batchIndex) => {
      const game = (window.__SCENE__ as unknown as { game: import('../../../src/Game').Game }).game;
      const samples = [];
      for (let frame = 0; frame < 60; frame++) {
        await window.__SS__!.step(1);
        if (batchIndex === 2 && frame >= 54 || batchIndex === 3 && frame < 6) await window.__SS__!.screenshotReady();
        const ids = new Set([...game.world.entities.iterate()].filter(e => /lion/.test(e.civilian?.zooAnimal ?? e.archetype)).map(e => e.id));
        samples.push({ png: (batchIndex === 2 && frame >= 54 || batchIndex === 3 && frame < 6) ? document.querySelector('canvas')!.toDataURL('image/png') : undefined, tick: game.world.tick, sim: [...ids].map(id => ({ id, transform: { ...game.world.entities.get(id)!.transform }, motion: structuredClone(game.world.entities.get(id)!.motion) })), figures: game.view.crowdFigures().filter(f => ids.has(f.id)) });
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
