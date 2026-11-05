/** Actual L2-11 radio camera census; ordinary native input, no actor changes. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import { provenance } from './accept/probe';
import type { Game } from '../../src/Game';

const out = 'test-results/fix55-a/L2-11-radio-view';
mkdirSync(`${out}/captures`, { recursive: true });
const rows: unknown[] = [];
try {
  for (const zoom of [.5, 1.5]) {
    const session = new SceneSession({ tier: 'low', backend: 'webgl2', viewport: { width: 1280, height: 720 } });
    try {
      await session.open(); await session.page.evaluate('window.__name = f => f');
      await session.page.evaluate(async zoom => {
        const a = window.__SS__!;
        await a.loadLevel('L2', { seed: 1, progression: 'L2-default' });
        a.missions.begin(); a.pause(); a.camera.follow(); a.camera.zoom(zoom); a.bot.start('no-axe');
        for (let i = 0; i < 240 && !a.missions.state()!.l2!.doorsOpenAt; i++) await a.step(30);
        for (let i = 0; i < 3600 && !a.missions.state()!.l2!.radioAt; i++) await a.step(1);
        if (!a.missions.state()!.l2!.radioAt) throw new Error('Ordinary no-axe route did not reach radio');
        await a.screenshotReady();
      }, zoom);
      const state = await session.page.evaluate(() => {
        const g = (window.__SCENE__ as unknown as { game: Game }).game, w = g.world, s = w.missions!.state.l2!, ai = w.infected!;
        const p = w.entities.get(1)!.transform;
        const actors = ai.active.filter(e => e.health.current > 0).map(e => {
          const b = e.infected!, q = e.transform;
          const corners = [-2, 2].flatMap(dx => [-.7, 3].flatMap(dy => [-2, 2].map(dz => g.view.project(q.x + dx, q.y + dy, q.z + dz))));
          const boxOffscreen = [0, 1, 2].some(axis => corners.every(v => v[axis] < -1) || corners.every(v => v[axis] > 1));
          return { id: e.id, ambush: s.ambushIds.includes(e.id), escape: s.escapeIds.includes(e.id), cluster: s.clusterIds.includes(e.id),
            at: { ...q }, distanceM: Math.hypot(q.x - p.x, q.z - p.z), mode: b.l1?.mode, target: b.l1?.targetId,
            directorOffscreen: ai.director.offscreen(q, q.y - .7), conservativeBoxOffscreen: boxOffscreen };
        });
        const rescue = actors.filter(e => !e.escape && !e.cluster);
        return { tier: 'low', zoom: g.view.view.playerZoom, tick: w.tick, radioAt: s.radioAt, doorsOpenAt: s.doorsOpenAt, player: { ...p }, hp: w.entities.get(1)!.health.current,
          cap: ai.director.cap, camera: g.view.getState().camera, actors, pending: structuredClone(s.pending),
          rescueCount: rescue.length, conservativeRescueInView: rescue.filter(e => !e.conservativeBoxOffscreen).length,
          offscreenNonBitingNonPlayerTargets: rescue.filter(e => e.ambush && e.directorOffscreen && e.mode !== 'bite' && e.target !== 1).map(e => e.id),
          conservativeSafeCandidates: rescue.filter(e => e.ambush && e.conservativeBoxOffscreen && e.mode !== 'bite' && e.target !== 1).map(e => e.id) };
      });
      assert(state.tick - state.radioAt <= 30); assert(state.hp > 0); assert.deepEqual(session.errors, []);
      const file = `${out}/captures/low-z${zoom}-radio.png`; await session.page.screenshot({ path: file });
      rows.push({ ...state, file, sha256: createHash('sha256').update(readFileSync(file)).digest('hex') });
      console.log(JSON.stringify({ zoom, tick: state.tick, radioAt: state.radioAt, rescue: state.rescueCount, possibleVisible: state.conservativeRescueInView, offscreenCandidates: state.offscreenNonBitingNonPlayerTargets.length, conservativeSafeCandidates: state.conservativeSafeCandidates.length }));
    } finally { await session.close(); }
  }
} finally {
  stopServer();
  writeFileSync(`${out}/receipt.json`, JSON.stringify({ ...provenance(), toolSha256: createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'),
    method: 'Actual production follow camera; ordinary no-axe native InputFrames; no survival protection or actor changes; radio census and candidate diagnostics only. Conservative boxes are4m wide and3.7m high. No performance timing.', rows }, null, 2) + '\n');
}
