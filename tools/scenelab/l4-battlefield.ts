import assert from 'node:assert/strict';
import type { Game } from '../../src/Game';
import { SceneSession, stopServer, writeJson, type Backend } from './session';

/** Production L4 war regression: whole-level corpse identity and drawn bodies, including a dense pile. */
const backend = (process.argv[2] ?? 'webgl2') as Backend;
const out = `test-results/alpha-idle/battlefield-${backend}`;
try {
  for (const tier of ['high', 'low'] as const) {
    const session = new SceneSession({ backend, tier });
    try {
      await session.open();
      const ids = await session.page.evaluate(async tier => {
        const api = window.__SS__!; await api.loadLevel('L4', { seed: 1 }); api.missions.begin(); api.pause(); api.cheats.god(true);
        const game = (window.__SCENE__ as unknown as { game: Game }).game, w = game.world, ai = w.infected!, s = w.missions!.state.l4!;
        ai.director.setTier(tier); s.phase = 'war'; s.turnAt = 1; s.warAt = 1; s.waveAt = 1e9; s.insideAt = 1e9;
        const p = w.entities.get(1)!; p.hidden = false; w.storyLock = null;
        const cell = ai.nav.nearestCell(-12, 27), x = ai.nav.x(cell), z = ai.nav.z(cell);
        api.teleport('player', { x: x + 3, z: z + 3 });
        const ids: number[] = [];
        for (let i = 0; i < 10; i++) {
          const outbreak = w.npcs!.civilians.outbreak!;
          const id = outbreak.spawnPedestrian({ x, z }, { model: 'npc.civilian-man-a' }); ids.push(id);
          const e = w.entities.get(id)!; outbreak.turnNow(e); e.transform.x += (i % 5 - 2) * .45; e.transform.z += Math.floor(i / 5) * .7;
          w.combat!.damage.apply({ sourceId: 1, targetId: id, attackId: 1000 + i, actionId: 'environment.fire', origin: p.transform, direction: { x: 0, z: 0 }, base: 999, multiplier: 1, type: 'status', permanent: true, stagger: 0, knockback: 0 });
        }
        // Warm the real death-to-frozen-page path without advancing the war's story beat.
        for (let i = 0; i < 150; i++) { s.turnAt = Math.max(1, w.tick); w.update(); game.view.frame(1 / 60); }
        const r = 19, polar = .30 * Math.PI;
        api.camera.cinematic({ position: [x + r * Math.sin(polar) / Math.sqrt(2), r * Math.cos(polar), z + r * Math.sin(polar) / Math.sqrt(2)], target: [x, 0, z] }, true);
        await api.step(2); await api.screenshotReady();
        return ids;
      }, tier);
      const before = await session.page.evaluate(() => {
        const game = (window.__SCENE__ as unknown as { game: Game }).game;
        return { tick: game.world.tick, corpses: [...game.world.entities.iterate()].filter(e => e.corpse).map(e => e.id), drawn: game.view.crowdFigures().filter(f => f.drawn).map(f => f.id), perf: window.__SS__!.perf(), crowd: window.__SS__!.getState().render.crowd };
      });
      await session.screenshot(`${out}/${tier}-before.png`);
      const after = await session.page.evaluate(async ids => {
        const game = (window.__SCENE__ as unknown as { game: Game }).game, w = game.world, s = w.missions!.state.l4!;
        let missing = 0;
        for (let i = 0; i < 7200; i++) {
          s.turnAt = Math.max(1, w.tick); w.update(); game.view.frame(1 / 60);
          for (const id of ids) if (!w.entities.get(id)?.corpse) missing++;
        }
        await window.__SS__!.step(2); await window.__SS__!.screenshotReady();
        return { tick: w.tick, phase: s.phase, missing, corpses: [...w.entities.iterate()].filter(e => e.corpse).map(e => e.id), drawn: game.view.crowdFigures().filter(f => f.drawn).map(f => f.id), backend: game.view.getState().backend, perf: window.__SS__!.perf(), crowd: window.__SS__!.getState().render.crowd };
      }, ids);
      await session.screenshot(`${out}/${tier}-after.png`);
      const proof = { tier, backend, ids, before, after, consoleErrors: session.errors };
      writeJson(`${out}/${tier}.json`, proof);
      assert.equal(after.missing, 0); assert.equal(after.phase, 'war');
      assert.equal(after.backend, backend === 'webgl2' ? 'webgl' : 'webgpu');
      assert(after.tick - before.tick >= 7200);
      for (const id of ids) { assert(before.corpses.includes(id)); assert(after.corpses.includes(id)); assert(before.drawn.includes(id), `initial corpse ${id} not drawn`); assert(after.drawn.includes(id), `final corpse ${id} not drawn`); }
      assert(after.corpses.length >= before.corpses.length);
      for (const sample of [before, after]) { assert(sample.perf.drawCalls <= (tier === 'high' ? 600 : 300)); assert(sample.perf.triangles <= (tier === 'high' ? 1500000 : 500000)); }
      assert.equal(session.errors.length, 0);
      console.log(`${backend} ${tier}: ${ids.length} bodies retained and drawn after ${(after.tick - before.tick) / 60}s`);
    } finally { await session.close(); }
  }
} finally { stopServer(); }
