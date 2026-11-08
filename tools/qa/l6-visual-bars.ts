/** Original L6 roster in compact-bar mode, batched on the unobstructed open exit floor. */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import type { Game } from '../../src/Game';
import { preset } from '../../src/sim/progression/Campaign';
import { SceneSession, stopServer } from '../scenelab/session';
import { provenance } from './accept/probe';
const overlap = process.env.L6_VISUAL_BAR_OVERLAP;
const out = overlap ? `test-results/l6-visual/bar-overlap-${overlap}` : 'test-results/l6-visual/bars-final'; mkdirSync(out, { recursive: true }); const rows = [];
try {
  for (const backend of ['webgl2', 'webgpu'] as const) for (const tier of ['low', 'high'] as const) {
    const session = new SceneSession({ backend, tier, query: { profile: '0', ui: '1' } });
    try {
      await session.open();
      const original = await session.page.evaluate(async ({ tier, save }) => {
        const a = window.__SS__!; a.settings.set({ quality: tier }); a.campaign.restore(save); await a.loadLevel('L6', { seed: 1 });
        a.pause(); a.missions.begin(); a.cheats.completeObjective('shelter'); a.cheats.completeObjective('stop');
        const w = (window.__SCENE__ as unknown as { game: Game }).game.world, s = w.missions!.state.l6!;
        // Move the original roster before a single simulation tick can expose the shelter to the skipped breach.
        for (const [i, r] of s.survivors.entries()) {
          r.status = 'following'; const e = w.entities.get(r.id)!; e.civilian!.survivor!.mode = 'follow';
          w.solids.relocate(e, { x: 100 + i * 2, z: 15, y: 1.3 }, 'probe.safe-roster', 0, false);
        }
        s.leaderX = 180; s.leaderZ = 15;
        a.teleport(1, { x: 256, z: 15.9 }); a.camera.follow();
        document.documentElement.setAttribute('data-scene-hud', '');
        for (const style of document.querySelectorAll('style')) if (style.textContent?.includes('#hud:not([data-scene-hud])')) style.remove();
        return s.survivors.map(r => ({ id: r.id, injured: r.injured, health: { ...w.entities.get(r.id)!.health } }));
      }, { tier, save: preset('L6-default') });
      for (let batch = 0; batch < (overlap ? 1 : original.length); batch++) {
        const ids = original.slice(batch, batch + 1).map(e => e.id);
        await session.page.evaluate(async ({ ids, overlap }) => {
          const a = window.__SS__!, w = (window.__SCENE__ as unknown as { game: Game }).game.world;
          ids.forEach(id => a.teleport(id, overlap ? { x: 257, z: 16.7 } : { x: 260, z: 15.9 }));
          await a.step(1); w.entities.get(1)!.transform.yaw = 0;
        }, { ids, overlap });
        for (const zoom of [1, 1.5]) {
          await session.page.evaluate(async zoom => { const a = window.__SS__!; a.camera.zoom(zoom); await a.step(0); }, zoom); await session.ready();
          const state = await session.page.evaluate(async ids => {
            const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game, w = g.world;
            const path = '/tools/qa/l6-bar-diagnostic.ts'; const { inspectL6Bars } = await import(path);
            return { diagnostic: inspectL6Bars(g, ids), backend: a.perf().backend, quality: a.getState().render.quality, camera: a.getState().render.camera, roster: w.missions!.state.l6!.survivors.length,
              selected: ids.map(id => ({ id, at: { ...w.entities.get(id)!.transform }, health: w.entities.get(id)!.health, mode: w.entities.get(id)!.civilian!.survivor!.mode })), bars: g.view.getState().healthBars, figures: a.crowdFigures().filter(f => ids.includes(f.id)) };
          }, ids);
          const file = `${out}/${backend}-${tier}-batch${batch}-z${zoom}.png`; await session.page.screenshot({ path: file });
          rows.push({ backend, tier, zoom, batch, ids, original, state, file, sha256: createHash('sha256').update(readFileSync(file)).digest('hex'), errors: [...session.errors] });
          writeFileSync(`${out}/receipt.json`, JSON.stringify({ ...provenance(), method: 'Declared presentation fixture. All29 original L6 roster identities and unmodified HP/injury flags remain alive in compact-bar mode. Immediately after scripted breach setup the entire cohort is moved out of danger; one identity at a time are placed on the unobstructed open exit floor, below its x263 evacuation threshold, with the courier4m away. Every selected ID must have its production bar; ordinary sim steps total only29ticks. No performance claim.', rows }, null, 2) + '\n');
          assert.ok(ids.every(id => overlap === 'before' ? !state.bars?.bars.some(b => b.id === id) : state.bars?.bars.some(b => b.id === id)), `${backend}/${tier}/z${zoom}/batch${batch}: missing selected bar`);
          assert.deepEqual(session.errors, []);
        }
        await session.page.evaluate(returns => { const w = (window.__SCENE__ as unknown as { game: Game }).game.world; returns.forEach(({ id, index }) => { if (!w.solids.relocate(w.entities.get(id)!, { x: 100 + index * 2, z: 15, y: 1.3 }, 'probe.return-roster', 0, false)) throw new Error(`Unable to return fixture actor${id}`); }); }, ids.map(id => ({ id, index: original.findIndex(e => e.id === id) })));
      }
      console.log(backend, tier, 'all29 bar identities at both zooms');
    } finally { await session.close(); }
  }
} finally { stopServer(); }
