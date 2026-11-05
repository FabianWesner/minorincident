import assert from 'node:assert/strict';
import type { Game } from '../../src/Game';
import { SceneSession, stopServer, writeJson, type Backend } from './session';

/** Capture the production L3 opening with ordinary complete-bot inputs at the game camera. */
const backend = (process.argv[2] ?? 'webgl2') as Backend;
const out = process.argv[3] ?? `test-results/l3-getup-balance/s1-${backend}`;
const captureX = Number(process.argv[4] ?? -110);
assert(captureX >= -126 && captureX < -40, 'capture X must be inside S1');
try {
  for (const tier of ['high', 'low'] as const) {
    const session = new SceneSession({ backend, tier, seed: 1 });
    try {
      await session.open();
      await session.page.evaluate(async () => {
        const api = window.__SS__!;
        await api.loadLevel('L3', { seed: 1 }); api.missions.begin(); api.pause(); api.bot.start('complete');
      });
      let reached = false;
      for (let i = 0; i < 180 && !reached; i++) {
        reached = await session.page.evaluate(async x => {
          const api = window.__SS__!; await api.step(60);
          const p = api.getState().player!.transform;
          return p.x >= x && p.x < -40 && p.z > 24;
        }, captureX);
      }
      assert(reached, `${tier}: complete bot did not reach S1 capture`);
      await session.page.evaluate(() => { window.__SS__!.bot.stop(); window.__SS__!.input.clear(); window.__SS__!.camera.follow(); });
      for (const zoom of [1, .5]) {
        const proof = await session.page.evaluate(async zoom => {
          const game = (window.__SCENE__ as unknown as { game: Game }).game;
          const rig = game.view.view;
          rig.reset(game.world.entities.get(1)!.transform); rig.zoom(Math.log(zoom));
          for (let i = 0; i < 60; i++) rig.update(game.world.entities.get(1)!.transform, 1 / 60);
          await window.__SS__!.screenshotReady();
          return { state: window.__SS__!.getState(), mission: window.__SS__!.missions.state(), perf: window.__SS__!.perf(), camera: rig.getState() };
        }, zoom);
        await session.screenshot(`${out}/${tier}-z${zoom}.png`);
        writeJson(`${out}/${tier}-z${zoom}.json`, { backend, tier, zoom, ...proof, consoleErrors: session.errors });
        assert.equal(proof.state.render.backend, backend === 'webgl2' ? 'webgl' : 'webgpu');
        assert.equal(proof.state.render.quality, tier);
        assert(Math.abs(proof.camera.zoom - zoom) < .001);
        assert(proof.perf.drawCalls <= (tier === 'high' ? 600 : 300));
        assert(proof.perf.triangles <= (tier === 'high' ? 1_500_000 : 500_000));
        assert.equal(session.errors.length, 0);
        console.log(`${backend} ${tier} z${zoom}: S1 x=${proof.state.player!.transform.x.toFixed(1)}, draws=${proof.perf.drawCalls}, triangles=${proof.perf.triangles}`);
      }
    } finally { await session.close(); }
  }
} finally { stopServer(); }
