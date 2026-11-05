/** Current production-camera evidence for the L2 runner-to-neighbor stimulus. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import { provenance } from './accept/probe';
import type { Game } from '../../src/Game';

const out = 'test-results/fix62-a/panic';
mkdirSync(`${out}/captures`, { recursive: true });
const runs = [];
try {
  for (const tier of ['low', 'high'] as const) {
    const session = new SceneSession({ tier, backend: 'webgl2', query: { ui: '1' } });
    try {
      await session.open();
      await session.page.evaluate('window.__name=f=>f');
      await session.page.evaluate(async tier => {
        const a = window.__SS__!;
        a.settings.set({ quality: tier });
        await a.loadLevel('L2', { seed: 1, progression: 'L2-default' });
        a.missions.begin(); a.pause(); a.camera.follow();
        document.documentElement.setAttribute('data-scene-hud', '');
        document.querySelectorAll('#hud,.hud').forEach(node => node.setAttribute('data-scene-hud', ''));
        await a.step(30);
        const w = (window.__SCENE__ as unknown as { game: Game }).game.world;
        const runner = w.entities.get(w.missions!.state.l2!.benchIds[1])!, p = runner.transform;
        w.npcs!.civilians.outbreak!.panic(runner, { x: p.x - Math.cos(p.yaw) * 5, z: p.z + Math.sin(p.yaw) * 5 });
      }, tier);
      const frames = [];
      let previous = 30;
      for (const tick of [30, 60, 120, 600]) {
        if (tick > previous) await session.page.evaluate(async n => window.__SS__!.step(n), tick - previous);
        previous = tick;
        const sample = await session.page.evaluate(() => {
          const w = (window.__SCENE__ as unknown as { game: Game }).game.world;
          return { tick: w.tick, bench: w.missions!.state.l2!.benchIds.map(id => {
            const e = w.entities.get(id)!;
            return { id, state: e.civilian!.state, at: { ...e.transform } };
          }) };
        });
        if (tick >= 120) assert(sample.bench.filter((_, index) => index !== 1).some(e => e.state !== 'calm'));
        for (const zoom of [.5, 1.5]) {
          await session.page.evaluate(async zoom => { window.__SS__!.camera.zoom(zoom); await window.__SS__!.screenshotReady(); }, zoom);
          const actualZoom = await session.page.evaluate(() => window.__SS__!.getState().render.camera.zoom);
          const file = `${out}/captures/${tier}-t${tick}-z${zoom}.png`;
          await session.page.screenshot({ path: file });
          frames.push({ file, sha256: createHash('sha256').update(readFileSync(file)).digest('hex'), zoom, actualZoom, sample });
        }
      }
      assert.deepEqual(session.errors, []);
      runs.push({ tier, frames });
      console.log(tier, frames.length);
    } finally { await session.close(); }
  }
} finally {
  stopServer();
  writeFileSync(`${out}/receipt.json`, JSON.stringify({ ...provenance(), method: 'One pre-existing bench civilian receives production panic. Every other actor is untouched. Production follow camera and actual zoom extremes, no actor relocation/injection; paused fixed-step observation. Behavior, not mortal route difficulty.', runs }, null, 2));
}
