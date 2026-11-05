/** Presentation-only depot and detour cue matrix; never route-readability qualification. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import { provenance } from './accept/probe';
import type { Game } from '../../src/Game';

const level = process.env.CUE_LEVEL === 'L1' ? 'L1' : 'L3';
const out = `test-results/fix62-a/cue-${level}`;
mkdirSync(`${out}/captures`, { recursive: true });
const runs = [];
try {
  for (const tier of (process.env.CUE_TIER ? [process.env.CUE_TIER as 'low' | 'high'] : ['low', 'high'] as const)) {
    const session = new SceneSession({ tier, backend: 'webgl2', query: { ui: '1' } });
    try {
      await session.open(); await session.page.evaluate('window.__name=f=>f');
      const load = () => session.page.evaluate(async ({tier,level}) => {
        const a = window.__SS__!; a.settings.set({ quality: tier });
        await a.loadLevel(level, { seed: 1, ...(level === 'L3' ? { progression: 'L3-default' } : {}) });
        a.missions.begin(); a.pause(); a.camera.follow(); a.camera.zoom(1); a.cheats.god(true);
        document.documentElement.setAttribute('data-scene-hud', '');
        document.querySelectorAll('#hud,.hud').forEach(node => node.setAttribute('data-scene-hud', ''));
      }, {tier,level});
      await load();
      const frames: { file: string; sha256: string; name: string; method: string; state: unknown }[] = [];
      const photo = async (name: string, zoom: number, method: string) => {
        await session.page.evaluate(async zoom => {
          const g = (window.__SCENE__ as unknown as { game: Game }).game;
          window.__SS__!.camera.zoom(zoom); g.view.frame(.25); g.view.update(1); await window.__SS__!.screenshotReady();
        }, zoom);
        const state = await session.page.evaluate(() => {
          const g = (window.__SCENE__ as unknown as { game: Game }).game;
          return { tick: g.world.tick, player: { ...g.world.entities.get(1)!.transform }, zoom: g.view.view.playerZoom,
            marker: g.world.missions?.state.marker, vfx: g.view.vfx!.snapshot() };
        });
        assert.equal(state.zoom, zoom, 'Requested normal-camera zoom limit must be applied');
        const file = `${out}/captures/${tier}-${name}-z${zoom}.png`;
        await session.page.screenshot({ path: file });
        frames.push({ file, sha256: createHash('sha256').update(readFileSync(file)).digest('hex'), name, method, state });
      };
      for (const [name, x, z] of (level === 'L3' ? [['first-crosslink', -96, 0], ['second-crosslink', -22, 28]] : [['depot-start', -20, 0]]) as [string,number,number][]) {
        await session.page.evaluate(async ({ x, z }) => {
          const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
          if (g.world.scenario === 'L3') a.teleport(1, { x, z }); g.view.view.reset(g.world.entities.get(1)!.transform);
          for (let i = 0; i < 8; i++) { await a.step(15); g.view.frame(.25); }
        }, { x, z });
        for (const zoom of [.5, 1.5]) await photo(`static-${name}`, zoom, 'Controlled normal follow camera cue pose; not screenshot-only route qualification.');
      }
      assert.deepEqual(session.errors, []);
      runs.push({ tier, frames }); console.log(tier, frames.length);
    } finally { await session.close(); }
  }
} finally {
  stopServer(); writeFileSync(`${out}/receipt.json`, JSON.stringify({ ...provenance(), runs }, null, 2));
}
