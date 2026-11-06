/** Clear-head per-ID bar controls for the unchanged original L6 roster. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import type { Game } from '../../src/Game';
import { preset } from '../../src/sim/progression/Campaign';
import { SceneSession, stopServer } from '../scenelab/session';
import { provenance } from './accept/probe';
const requestedTier = process.argv[2]; if (requestedTier !== 'low' && requestedTier !== 'high') throw new Error('Expected low/high');
const tier: 'low' | 'high' = requestedTier;
const out = `test-results/sweep-b/L6-bars-${tier}`; mkdirSync(`${out}/captures`, { recursive: true });
const session = new SceneSession({ tier, backend: 'webgl2', query: { profile: '0', ui: '1' } });
try {
  await session.open(); const save = preset('L6-default'); save.settings.quality = tier;
  const original = await session.page.evaluate(async ({ tier, save }) => {
    const a = window.__SS__!; a.settings.set({ quality: tier }); a.campaign.restore(save); await a.loadLevel('L6', { seed: 1 });
    a.pause(); a.missions.begin(); a.cheats.god(false); a.camera.zoom(1.5); a.camera.follow();
    a.cheats.completeObjective('shelter'); a.cheats.completeObjective('stop'); await a.step(30);
    const w = (window.__SCENE__ as unknown as { game: Game }).game.world;
    // Retain every original actor and HP. Only activate follower presentation;
    // stage one identity at a time on the actual open Northgate exit floor.
    for (const r of w.missions!.state.l6!.survivors) w.entities.get(r.id)!.civilian!.survivor!.mode = 'follow';
    return w.missions!.state.l6!.survivors.map(r => ({ id: r.id, injured: r.injured, at: { ...w.entities.get(r.id)!.transform }, health: { ...w.entities.get(r.id)!.health } }));
  }, { tier, save });
  const rows = [];
  for (const actor of original) {
    const state = await session.page.evaluate(async actor => {
      const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game, w = g.world, s = w.missions!.state.l6!;
      a.teleport(1, { x: 256, z: 15.9 });
      const e = w.entities.get(actor.id)!;
      const r = s.survivors.find(r => r.id === e.id)!; r.status = 'following'; r.collected = false; r.straggler = false;
      a.teleport(e.id, { x: 260, z: 15.9 }); e.hidden = false; e.civilian!.activityUntil = 0; e.civilian!.story = null;
      s.leaderX = 260; s.leaderZ = 15.9;
      a.camera.follow(); await a.step(30); await a.screenshotReady();
      return { id: e.id, injured: actor.injured, at: { ...e.transform }, health: { ...e.health }, civilian: e.civilian, rosterCount: s.survivors.length, actualTier: w.infected!.director.tier,
        bars: g.view.getState().healthBars, figures: a.crowdFigures().filter(f => f.id === e.id), camera: g.view.getState().camera, player: { ...w.entities.get(1)!.transform }, god: w.combat!.damage.god };
    }, actor);
    const path = `${out}/captures/${tier}-${actor.id}.png`; await session.page.screenshot({ path });
    rows.push({ ...state, capture: path, sha256: createHash('sha256').update(readFileSync(path)).digest('hex') });
    await session.page.evaluate(actor => {
      const w = (window.__SCENE__ as unknown as { game: Game }).game.world, e = w.entities.get(actor.id)!;
      w.solids.relocate(e, actor.at, 'probe.restore-roster', 0, false); w.missions!.state.l6!.survivors.find(r => r.id === e.id)!.status = 'shelter';
    }, actor);
    console.log(tier, actor.id, JSON.stringify(state.bars));
    writeFileSync(`${out}/ledger.json`, JSON.stringify({ ...provenance(), producerSha256: createHash('sha256').update(readFileSync('tools/qa/sweep-b-l6-bars.ts')).digest('hex'),
      method: 'Explicit bar presentation control, not a full route: every original29-person identity and HP retained, injured flags unchanged, follower modes active; move one at a time to the existing open exit floor while courier is4m away. Render actual production bars and actual body, thirty simticks after each relocation. Original positions restored each time. Staged x260 remains below the actual x263 evacuation threshold. No speed, health, counts or acceptance changes. Compact bar mode still sees the full roster.', original, rows, errors: session.errors }, null, 2) + '\n');
  }
} finally { await session.close(); stopServer(); }
