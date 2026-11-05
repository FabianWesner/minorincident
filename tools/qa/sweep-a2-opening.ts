/** Untouched L2 opening: seat geometry and optional axe ring at actual gameplay zooms. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import { provenance } from './accept/probe';
import type { Game } from '../../src/Game';

const out = 'test-results/sweep-a2/L2-opening';
mkdirSync(`${out}/captures`, { recursive: true });
const rows = [];
try {
  for (const backend of ['webgl2', 'webgpu'] as const) for (const tier of ['low', 'high'] as const) {
    const s = new SceneSession({ backend, tier, query: { ui: '1' } });
    try {
      await s.open();
      await s.page.evaluate('window.__name=f=>f');
      await s.page.evaluate(async tier => {
        const a = window.__SS__!;
        a.settings.set({ quality: tier });
        await a.loadLevel('L2', { seed: 1, progression: 'L2-default' });
        a.missions.begin(); a.pause(); a.camera.follow();
        document.documentElement.setAttribute('data-scene-hud', '');
        document.querySelectorAll('#hud,.hud').forEach(n => n.setAttribute('data-scene-hud', ''));
        await a.step(30);
      }, tier);
      for (const zoom of [.5, 1, 1.5]) {
        const state = await s.page.evaluate(async zoom => {
          const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
          a.camera.zoom(zoom); await a.screenshotReady();
          const w = g.world, l2 = w.missions!.state.l2!, render = a.getState().render;
          return { tick: w.tick, actualZoom: g.view.view.playerZoom, phase: l2.phase,
            backend: render.backend, quality: render.quality, camera: render.camera,
            bench: l2.benchIds.map(id => { const e = w.entities.get(id)!; return { id, at: { ...e.transform }, state: e.civilian?.state, hidden: !!e.hidden, story: e.civilian?.story }; }),
            axe: l2.axe, axeAnchor: w.missions!.def.anchors['l2-axe-rack'], marker: render.missionMarker };
        }, zoom);
        assert.equal(state.actualZoom, zoom); assert.equal(state.quality, tier);
        const file = `${out}/captures/${backend}-${tier}-z${zoom}.png`;
        await s.page.screenshot({ path: file });
        rows.push({ backend, tier, zoom, state, file, sha256: createHash('sha256').update(readFileSync(file)).digest('hex') });
      }
      assert.deepEqual(s.errors, []);
      console.log(backend, tier, 'opening captured');
    } finally { await s.close(); }
  }
} finally {
  stopServer();
  writeFileSync(`${out}/receipt.json`, JSON.stringify({ ...provenance(), rows,
    method: 'Untouched ordinary L2 opening, seed1, no input/bot/relocation/protection/actor injection. Same tick30 at each actual zoom. Pooled headless browsers, full HUD, no performance timing.' }, null, 2) + '\n');
}
