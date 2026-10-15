import assert from 'node:assert/strict';
import type { Game } from '../../src/Game';
import { SceneSession, stopServer, writeJson, type Backend } from './session';

/** Capture the production L3 Boulevard detour with ordinary complete-bot inputs at the game camera.
 * Live damage stays enabled; the unchanged real-input playthrough supplies the survival gate. */
const backend = (process.argv[2] ?? 'webgl2') as Backend;
const out = process.argv[3] ?? `test-results/l3-blvd-browser/production-${backend}`;
const captureX = Number(process.argv[4] ?? 10);
assert(captureX >= -10 && captureX < 120, 'capture X must be inside the Boulevard detour');
try {
  for (const tier of ['high', 'low'] as const) {
    const session = new SceneSession({ backend, tier, seed: 1 });
    try {
      await session.open();
      await session.page.evaluate(async () => {
        const api = window.__SS__!;
        await api.loadLevel('L3', { seed: 1 }); api.missions.begin(); api.pause(); api.cheats.god(false); api.bot.start('complete');
      });
      let reached = false;
      for (let i = 0; i < 900 && !reached; i++) {
        reached = await session.page.evaluate(async x => {
          const api = window.__SS__!; await api.step(60);
          const p = api.getState().player!.transform;
          return p.x >= x && p.x < 132 && p.z < -20;
        }, captureX);
      }
      assert(reached, `${tier}: complete bot did not reach Boulevard capture: ${JSON.stringify(await session.page.evaluate(() => ({ player: window.__SS__!.getState().player!.transform, phase: window.__SS__!.missions.state()?.phase })))}`);
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
        console.log(`${backend} ${tier} z${zoom}: Boulevard x=${proof.state.player!.transform.x.toFixed(1)}, draws=${proof.perf.drawCalls}, triangles=${proof.perf.triangles}`);
      }
    } finally { await session.close(); }
  }
} finally { stopServer(); }
