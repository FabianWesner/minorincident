/** Real moving squad shot and damage, with unchanged native inputs and read-only event capture. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import { provenance } from './accept/probe';
import type { Game } from '../../src/Game';

const out = 'test-results/fix64-a/fire';
mkdirSync(out, { recursive: true });
const runs = [];
try {
  for (const tier of ['low', 'high'] as const) {
    const session = new SceneSession({ tier, backend: 'webgl2', query: { ui: '1' } });
    try {
      await session.open(); await session.page.evaluate('window.__name=f=>f');
      const state = await session.page.evaluate(async tier => {
        const a = window.__SS__!;
        await a.loadLevel('L3', { seed: 1, progression: 'L3-default' });
        a.settings.set({ quality: tier }); a.missions.begin(); a.pause(); a.camera.follow(); a.camera.zoom(1);
        document.documentElement.setAttribute('data-scene-hud', '');
        const g = (window.__SCENE__ as unknown as { game: Game }).game, w = g.world;
        const hits: unknown[] = [];
        let movingHit = false;
        const off = w.events.on('combat.hit', e => {
          const s = w.missions!.state.l3!;
          if (e.type !== 'combat.hit' || e.amount <= 0 || e.damageType !== 'bullet' || !s.fallbackAt || s.segment >= 1 || !s.squad.some(q => q.id === e.sourceId)) return;
          const actor = w.entities.get(e.sourceId)!, leader = w.entities.get(1)!;
          const speed = actor.motion?.speed ?? 0, leaderSpeed = Math.hypot(leader.survivor!.velocity.x, leader.survivor!.velocity.z);
          hits.push({ ...e, speed, leaderSpeed, source: { ...actor.transform }, sourceHp: actor.health.current });
          movingHit ||= speed > .5 && leaderSpeed > .5;
        });
        a.bot.start('complete', { street: 'auto' });
        try {
          for (let i = 0; i < 9000 && !movingHit; i++) {
            await a.step(1); if (i % 5 === 0) g.view.frame(5 / 60);
            if (w.missions!.state.l3!.fallbackAt && !w.missions!.state.l3!.squad.length) break;
          }
        } finally { off(); a.bot.stop(); a.input.clear(); }
        return { tick: w.tick, movingHit, hits, player: { ...w.entities.get(1)!.transform },
          phase: w.missions!.state.l3!.phase, fallbackAt: w.missions!.state.l3!.fallbackAt };
      }, tier);
      assert.ok(state.movingHit, `${tier} must reach a real moving squad hit`);
      const frames = [];
      // The production yard encounter locks zoom at1; retain its actual default frame.
      for (const zoom of [1]) {
        const actual = await session.page.evaluate(async zoom => {
          const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
          a.camera.zoom(zoom); g.view.frame(.25); g.view.update(1); await a.screenshotReady();
          return g.view.view.playerZoom;
        }, zoom);
        assert.equal(actual, zoom);
        const file = `${out}/${tier}-hit-z${zoom}.png`;
        await session.page.screenshot({ path: file });
        frames.push({ file, zoom: actual, sha256: createHash('sha256').update(readFileSync(file)).digest('hex') });
      }
      assert.deepEqual(session.errors, []);
      runs.push({ tier, state, frames }); console.log(tier, state.tick, state.hits.length);
    } finally { await session.close(); }
  }
} finally {
  stopServer(); writeFileSync(`${out}/receipt.json`, JSON.stringify({ ...provenance(), runs }, null, 2) + '\n');
}
