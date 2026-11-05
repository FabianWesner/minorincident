/** PO 11-05 alarm cover and moving-fire presentation; native InputFrames, shared headless pool. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../../scenelab/session';
import { provenance } from '../accept/probe';
import type { Game } from '../../../src/Game';

const out = process.env.FIX63_CAPTURE_OUT ?? 'test-results/fix63-a/L3-final';
mkdirSync(`${out}/captures`, { recursive: true });
const runs: unknown[] = [];
try {
  for (const tier of (process.env.FIX63_TIER ? [process.env.FIX63_TIER as 'low' | 'high'] : ['low', 'high'] as const)) {
    const session = new SceneSession({ tier, backend: 'webgl2', query: { ui: '1' } });
    const frames: unknown[] = [];
    try {
      await session.open(); await session.page.evaluate('window.__name=f=>f');
      await session.page.evaluate(async tier => {
        const a = window.__SS__!; a.settings.set({ quality: tier });
        await a.loadLevel('L3', { seed: 1, progression: 'L3-default' });
        a.missions.begin(); a.pause(); a.camera.follow(); a.camera.zoom(1);
        document.documentElement.setAttribute('data-scene-hud', '');
        document.querySelectorAll('#hud,.hud').forEach(n => n.setAttribute('data-scene-hud', ''));
      }, tier);
      const photo = async (name: string, method: string) => {
        await session.page.evaluate(async () => {
          const g = (window.__SCENE__ as unknown as { game: Game }).game;
          g.view.frame(.25); g.view.update(1); await window.__SS__!.screenshotReady();
        });
        const state = await session.page.evaluate(() => {
          const g = (window.__SCENE__ as unknown as { game: Game }).game, w = g.world, s = w.missions!.state.l3!;
          return { tick: w.tick, player: { ...w.entities.get(1)!.transform }, zoom: g.view.view.playerZoom, phase: s.phase,
            attackAt: s.attackAt, fallbackAt: s.fallbackAt,
            cover: w.districts!.districts.flatMap(d => d.layout.placements.filter(p => p.id === 'l3-alarm-cover')),
            squad: s.squad.map(q => { const e = w.entities.get(q.id)!; return { id: e.id, health: e.health.current, transform: { ...e.transform }, speed: e.motion?.speed, story: e.civilian?.story, target: e.civilian?.ally?.targetId }; }),
            opening: s.waves.filter(q => q.wave === 0).map(q => { const e = w.entities.get(q.id); return { ...q, transform: e ? { ...e.transform } : null, visible: !!e && w.infected!.director.inFrame(e.transform) }; }) };
        });
        const file = `${out}/captures/${tier}-${name}.png`;
        await session.page.screenshot({ path: file });
        frames.push({ file, sha256: createHash('sha256').update(readFileSync(file)).digest('hex'), name, method, state });
      };
      await session.page.evaluate(() => window.__SS__!.bot.start('complete', { street: 'auto' }));
      await session.page.evaluate(async () => {
        const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
        for (let i = 0; i < 3000 && !g.world.missions!.state.l3!.attackAt; i++) { await a.step(1); if (i % 15 === 0) g.view.frame(.25); }
      });
      await photo('alarm-start', 'Fresh mortal native complete InputFrames; default follow camera, no relocation.');
      for (const ticks of [30, 60, 90, 120]) {
        await session.page.evaluate(async () => { const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game; for (let i = 0; i < 2; i++) { await a.step(15); g.view.frame(.25); } });
        await photo(ticks === 120 ? 'alarm-two-seconds' : `alarm-${ticks}ticks`, `Exact first alarm +${ticks} ticks; default follow camera. Frustum census is separate from pixel review.`);
      }
      // A close Scene Lab inspection of the actual new placement and its neighbours.
      await session.page.evaluate(() => {
        const g = (window.__SCENE__ as unknown as { game: Game }).game;
        const p = g.world.districts!.districts.flatMap(d => d.layout.placements).find(p => p.id === 'l3-alarm-cover')!;
        window.__SS__!.camera.cinematic({ position: [p.position[0] + 8, 8, p.position[2] + 10], target: [p.position[0], 1, p.position[2]] }, true);
      });
      await photo('cover-inspection', 'Scene Lab close view of actual production placement; no actors or props moved.');
      await session.page.evaluate(() => { window.__SS__!.camera.follow(); window.__SS__!.camera.zoom(1.5); });
      const shots = await session.page.evaluate(async () => {
        const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game, w = g.world;
        const shots: { tick: number; id: number; speed: number; leaderSpeed: number; inSquad: boolean }[] = [];
        const off = w.events.on('ally.attack', e => {
          if (e.type !== 'ally.attack' || !e.from) return;
          const shooter = w.entities.get(e.sourceId), leader = w.entities.get(1)!;
          const inSquad = !!shooter?.civilian?.ally?.follow;
          if (inSquad) shots.push({ tick: e.tick, id: e.sourceId, speed: shooter.motion?.speed ?? 0, leaderSpeed: Math.hypot(leader.survivor!.velocity.x, leader.survivor!.velocity.z), inSquad });
        });
        try {
          for (let i = 0; i < 2400; i++) {
            await a.step(5); g.view.frame(5 / 60);
            if (shots.some(s => s.speed > .5 && s.leaderSpeed > .5)) break;
            if (w.missions!.state.l3!.fallbackAt && !w.missions!.state.l3!.squad.length) break;
          }
        } finally { off(); }
        return shots;
      });
      await photo('following-fire-z1.5', 'Mortal native complete route, actual zoom1.5; shot ledger discloses whether a moving squad shot was reached.');
      assert.deepEqual(session.errors, []);
      runs.push({ tier, frames, shots, errors: session.errors });
      console.log(tier, 'frames', frames.length, 'squad shots', shots.length, 'moving', shots.filter(s => s.speed > .5 && s.leaderSpeed > .5).length);
    } finally { await session.close(); }
  }
} finally {
  stopServer(); writeFileSync(`${out}/receipt.json`, JSON.stringify({ ...provenance(), runs }, null, 2) + '\n');
}
