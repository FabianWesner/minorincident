/** Actual passenger game-camera reproduction of PO13 (seed 1, tick 1016).
 * Run after build through tools/e2e-lock.sh; SceneSession is always headless. */
import type { View } from '../../src/render/View';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer, type Backend } from '../scenelab/session';
const out = 'test-results/l4-boundary-refuge/ride';
mkdirSync(out, { recursive: true });
const results: unknown[] = [];
try {
  for (const backend of ['webgl2', 'webgpu'] as Backend[]) for (const tier of ['high', 'low'] as const) {
    const s = new SceneSession({ backend, tier, viewport: { width: 1280, height: 720 }, query: { ui: '1' } });
    try {
      await s.open();
      await s.page.evaluate(async tier => {
        const a = window.__SS__!; await a.loadLevel('L4', { seed: 1, progression: 'L4-default' });
        a.settings.set({ quality: tier }); a.pause(); a.missions.begin(); a.cheats.god(true); a.camera.follow();
        await a.step(1016);
      }, tier);
      for (const zoom of [1, .5]) {
        await s.page.evaluate(zoom => {
          const v = (window.__SCENE__ as unknown as { game: { view: { view: View } } }).game.view.view;
          v.zoom(Math.log(zoom / v.getState().targetZoom), true);
          window.__SS__!.step(1);
        }, zoom);
        await s.page.evaluate(() => window.__SS__!.screenshotReady());
        const state = await s.page.evaluate(() => {
          const a = window.__SS__!, state = a.getState(), perf = a.perf();
          return { tick: a.tick(), mission: a.missions.state()!.l4, player: state.player, camera: state.render.camera, pickups: a.query({ kind: 'pickup' }), backend: perf.backend, tier: perf.quality.tier, draws: perf.drawCalls, triangles: perf.triangles };
        });
        assert.equal(state.backend, backend === 'webgl2' ? 'webgl' : 'webgpu'); assert.equal(state.tier, tier);
        assert.ok(state.draws <= (tier === 'high' ? 600 : 300)); assert.ok(state.triangles <= (tier === 'high' ? 1_500_000 : 500_000));
        const file = `${out}/${backend}-${tier}-z${zoom}.jpg`;
        await s.page.screenshot({ path: file, type: 'jpeg', quality: 88 });
        results.push({ file, ...state }); console.log(`${backend}/${tier}/z${zoom}: ${state.draws} draws, ${state.triangles} triangles`);
      }
      assert.deepEqual(s.errors, []);
    } finally { await s.close(); }
  }
} finally { writeFileSync(`${out}/proof.json`, JSON.stringify(results, null, 2)); stopServer(); }
