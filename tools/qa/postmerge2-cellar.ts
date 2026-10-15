/** Real mission-camera evidence for the relocated L5 cellar, after a fresh build and e2e-lock admission. */
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import type { View } from '../../src/render/View';
import { SceneSession, stopServer, type Backend } from '../scenelab/session';
const out = 'docs/reports/postmerge-2/cellar';
mkdirSync(out, { recursive: true });
const rows: unknown[] = [];
try {
  for (const backend of ['webgl2', 'webgpu'] as Backend[]) for (const tier of ['high', 'low'] as const) {
    const session = new SceneSession({ backend, tier, viewport: { width: 1280, height: 720 }, query: { ui: '1' } });
    try {
      await session.open();
      await session.page.evaluate(async tier => {
        const a = window.__SS__!; await a.loadLevel('L5', { seed: 1, progression: 'L5-default' });
        a.settings.set({ quality: tier }); a.pause(); a.missions.begin(); a.cheats.completeObjective('emerge'); a.camera.follow(); await a.step(120);
      }, tier);
      for (const zoom of [1, .5]) {
        await session.page.evaluate(zoom => {
          const view = (window.__SCENE__ as unknown as { game: { view: { view: View } } }).game.view.view;
          view.zoom(Math.log(zoom / view.getState().targetZoom), true); window.__SS__!.step(30);
        }, zoom);
        await session.ready();
        const state = await session.page.evaluate(() => {
          const a = window.__SS__!, s = a.getState(), p = a.perf();
          return { backend: p.backend, tier: p.quality.tier, player: s.player, camera: s.render.camera, mission: a.missions.state()!.l5, draws: p.drawCalls, triangles: p.triangles };
        });
        assert.equal(state.backend, backend === 'webgl2' ? 'webgl' : 'webgpu'); assert.equal(state.tier, tier);
        assert.notEqual(state.mission!.phase, 'cellar');
        assert.ok(Math.hypot(state.camera.focus[0] - state.player!.transform.x, state.camera.focus[2] - state.player!.transform.z) < .5, 'follow camera must settle at the exit');
        assert.ok(state.draws <= (tier === 'high' ? 600 : 300)); assert.ok(state.triangles <= (tier === 'high' ? 1_500_000 : 500_000));
        const file = `${out}/${backend}-${tier}-z${zoom}.jpg`;
        await session.page.screenshot({ path: file, type: 'jpeg', quality: 88 });
        const png = PNG.sync.read(await session.page.screenshot({ type: 'png' })), colours = new Uint32Array(4096);
        let samples = 0, dominant = 0;
        for (let i = 0; i < png.data.length; i += 20) {
          const key = (png.data[i] >> 4) << 8 | (png.data[i + 1] >> 4) << 4 | png.data[i + 2] >> 4;
          dominant = Math.max(dominant, ++colours[key]); samples++;
        }
        const dominantShare = dominant / samples;
        rows.push({ file, dominantShare, ...state });
        assert.ok(dominantShare < .5, 'the cellar exit must show the street, not one enclosing surface');
        console.log(`${file}: ${state.draws} draws/${state.triangles} triangles`);
      }
      assert.deepEqual(session.errors, []);
    } finally { await session.close(); }
  }
} finally { writeFileSync(`${out}/proof.json`, JSON.stringify(rows, null, 2)); stopServer(); }
