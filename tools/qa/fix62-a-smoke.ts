/** L3 smoke: all three street types, plus the moving route's early counterexamples. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import { provenance } from './accept/probe';
import type { Game } from '../../src/Game';

const out = 'test-results/fix62-a/smoke';
mkdirSync(`${out}/captures`, { recursive: true });
const runs = [];
try {
  for (const tier of (process.env.SMOKE_TIER ? [process.env.SMOKE_TIER as 'low' | 'high'] : ['low', 'high'] as const)) {
    const session = new SceneSession({ tier, backend: 'webgl2', query: { ui: '1' } });
    try {
      await session.open(); await session.page.evaluate('window.__name=f=>f');
      const load = () => session.page.evaluate(async tier => {
        const a = window.__SS__!; a.settings.set({ quality: tier });
        await a.loadLevel('L3', { seed: 1, progression: 'L3-default' });
        a.missions.begin(); a.pause(); a.camera.follow(); a.camera.zoom(1); a.cheats.god(true);
        document.documentElement.setAttribute('data-scene-hud', '');
        document.querySelectorAll('#hud,.hud').forEach(node => node.setAttribute('data-scene-hud', ''));
      }, tier);
      await load();
      const frames: { file: string; sha256: string; name: string; method: string; state: unknown }[] = [];
      const photo = async (name: string, zoom: number, method: string) => {
        await session.page.evaluate(async zoom => {
          const g = (window.__SCENE__ as unknown as { game: Game }).game;
          window.__SS__!.camera.zoom(zoom); g.view.frame(.25); g.view.update(1); await window.__SS__!.screenshotReady();
        }, zoom);
        const state = await session.page.evaluate(() => {
          const g = (window.__SCENE__ as unknown as { game: Game }).game;
          const blasts = g.view.vfx!.blasts as unknown as { cloudColumns: Map<number, { x: number; z: number; street?: boolean }> };
          return { tick: g.world.tick, player: { ...g.world.entities.get(1)!.transform }, zoom: g.view.view.playerZoom,
            columns: [...blasts.cloudColumns].filter(([, c]) => c.street).map(([id, c]) => ({ id, x: c.x, z: c.z })), vfx: g.view.vfx!.snapshot() };
        });
        const file = `${out}/captures/${tier}-${name}-z${zoom}.png`;
        await session.page.screenshot({ path: file });
        frames.push({ file, sha256: createHash('sha256').update(readFileSync(file)).digest('hex'), name, method, state });
      };
      for (const [name, x, z] of [['oak', -80, 28], ['commerce', -40, 0], ['boulevard', 18, -28]] as const) {
        await session.page.evaluate(async ({ x, z }) => {
          const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
          a.teleport(1, { x, z }); g.view.view.reset(g.world.entities.get(1)!.transform);
          for (let i = 0; i < 8; i++) { await a.step(15); g.view.frame(.25); }
        }, { x, z });
        for (const zoom of [.5, 1.5]) await photo(`static-${name}`, zoom, 'Controlled street pose; not route evidence.');
      }
      await load();
      await session.page.evaluate(() => window.__SS__!.bot.start('complete', { street: 'auto' }));
      const pending = process.env.SMOKE_STATIC_ONLY === '1' ? [] : [-80, -40], samples = [];
      for (let step = 0; step < 1800 && pending.length; step++) {
        await session.page.evaluate(async () => { await window.__SS__!.step(15); (window.__SCENE__ as unknown as { game: Game }).game.view.frame(.25); });
        const sample = await session.page.evaluate(() => {
          const g = (window.__SCENE__ as unknown as { game: Game }).game;
          const blasts = g.view.vfx!.blasts as unknown as { cloudColumns: Map<number, { street?: boolean }> };
          return { tick: g.world.tick, player: { ...g.world.entities.get(1)!.transform }, columns: [...blasts.cloudColumns].filter(([, c]) => c.street).map(([id]) => id) };
        });
        samples.push(sample);
        if (sample.player.x >= pending[0]) {
          const x = pending.shift()!;
          for (const zoom of [.5, 1, 1.5]) await photo(`moving-x${x}`, zoom, 'Ordinary complete native InputFrames from fresh L3; no relocation, only courier damage protection.');
          await session.page.evaluate(() => window.__SS__!.camera.zoom(1));
        }
      }
      assert.equal(pending.length, 0, 'Native route must reach both smoke counterexample regions');
      assert.deepEqual(session.errors, []);
      runs.push({ tier, frames, samples }); console.log(tier, frames.length);
    } finally { await session.close(); }
  }
} finally {
  stopServer(); writeFileSync(`${out}/receipt.json`, JSON.stringify({ ...provenance(), runs }, null, 2));
}
