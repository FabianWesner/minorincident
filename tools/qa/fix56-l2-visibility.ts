/** L2-06: production no-axe input, actual follow camera and rendered body visibility. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import { provenance } from './accept/probe';
import type { Game } from '../../src/Game';

const out = process.env.L2_VISIBILITY_OUT ?? 'test-results/fix56-a/L2-06-visibility';
const backend = process.env.L2_VISIBILITY_BACKEND === 'webgpu' ? 'webgpu' : 'webgl2';
mkdirSync(`${out}/captures`, { recursive: true });
const rows: unknown[] = [];
try {
  for (const tier of ['low', 'high'] as const) for (const zoom of [.5, 1.5]) {
    const session = new SceneSession({ tier, backend, viewport: { width: 1280, height: 720 } });
    try {
      await session.open();
      await session.page.evaluate('window.__name = f => f');
      await session.page.evaluate(async ({ tier, zoom }) => {
        const a = window.__SS__!;
        a.settings.set({ quality: tier });
        await a.loadLevel('L2', { seed: 1, progression: 'L2-default' });
        a.missions.begin(); a.pause(); a.camera.follow(); a.camera.zoom(zoom); a.bot.start('no-axe');
        for (let i = 0; i < 240 && a.missions.state()!.l2!.phase !== 'doors'; i++) await a.step(30);
        if (a.missions.state()!.l2!.phase !== 'doors') throw new Error('Ordinary bot did not reach door forcing');
        for (let i = 0; i < 300 && !a.missions.state()!.l2!.doorsOpenAt; i++) await a.step(1);
        if (!a.missions.state()!.l2!.doorsOpenAt) throw new Error('No doorsOpen event');
        await a.screenshotReady();
      }, { tier, zoom });
      const capture = async (beat: string) => {
        const file = `${out}/captures/${tier}-z${zoom}-${beat}.png`;
        await session.page.screenshot({ path: file });
        return { file, sha256: createHash('sha256').update(readFileSync(file)).digest('hex') };
      };
      const opening = await capture('open');
      const state = await session.page.evaluate(async () => {
        const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
        const measure = () => {
          const s = g.world.missions!.state.l2!;
          return { tick: g.world.tick, doorsOpenAt: s.doorsOpenAt, afterS: (g.world.tick - s.doorsOpenAt) / 60,
          zoom: g.view.view.playerZoom, quality: a.getState().render.quality, backend: a.getState().render.backend,
          radioAt: s.radioAt, player: { ...g.world.entities.get(1)!.transform }, ambushIds: [...s.ambushIds], actors: s.ambushIds.map(id => {
            const e = g.world.entities.get(id)!;
            const p = e.transform;
            const corners = [-2, 2].flatMap(dx => [-.7, 3].flatMap(dy => [-2, 2].map(dz => g.view.project(p.x + dx, p.y + dy, p.z + dz))));
            const offscreen = [0, 1, 2].some(axis => corners.every(v => v[axis] < -1) || corners.every(v => v[axis] > 1));
            const projectedBounds = [0, 1, 2].map(axis => [Math.min(...corners.map(v => v[axis])), Math.max(...corners.map(v => v[axis]))]);
            return { id, hp: e.health.current, hidden: !!e.hidden, at: { ...p }, conservativeBox: { radiusM: 2, heightAboveRootM: 3 }, projectedBounds, offscreen };
          }) };
        };
        const samples = [measure()];
        while (a.tick() - a.missions.state()!.l2!.doorsOpenAt < 30) {
          await a.step(1); await a.screenshotReady(); samples.push(measure());
        }
        return { ...samples.at(-1)!, samples: samples.map(sample => ({ tick: sample.tick, afterS: sample.afterS,
          actors: sample.actors.map(actor => ({ id: actor.id, projectedBounds: actor.projectedBounds, offscreen: actor.offscreen })) })) };
      });
      assert.equal(state.afterS, .5); assert.equal(state.zoom, zoom); assert.equal(state.quality, tier);
      const normal = await capture('half-second');
      // Presentation-only positive control, after the measured follow-camera
      // sample: no simulation tick, actor, health or input state changes.
      await session.page.evaluate(() => {
        const g = (window.__SCENE__ as unknown as { game: Game }).game;
        const id = g.world.missions!.state.l2!.ambushIds[0], p = g.world.entities.get(id)!.transform;
        g.view.view.inspectionPose = { position: [p.x + 5, p.y + 12, p.z + 5], target: [p.x, p.y, p.z] };
        g.view.update(1);
      });
      const controlNormal = await capture('control-normal');
      assert.deepEqual(session.errors, []);
      const allBodyBoundsOffscreen = state.actors.length > 0 && state.samples.every(sample => sample.actors.every(actor => actor.offscreen));
      rows.push({ tier, ...state, allBodyBoundsOffscreen, captures: [opening, normal, controlNormal] });
      console.log(JSON.stringify({ tier, zoom, afterS: state.afterS, samples: state.samples.length, allBodyBoundsOffscreen }));
    } finally { await session.close(); }
  }
} finally {
  stopServer();
  writeFileSync(`${out}/receipt.json`, JSON.stringify({ ...provenance(),
    toolSha256: createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'),
    method: 'Ordinary no-axe native InputFrames; fixed sim ticks; actual production follow camera. Every tick from doorsOpen through+0.5s records conservative4m-wide/3.7m-high projected body boxes. Entire boxes outside a frustum plane prove absence; overlap cannot prove visibility. Production frames and a presentation-only camera control are retained. CrowdView ID masks do not cover NPC-dressed infected and are not used. No performance timing.', rows }, null, 2) + '\n');
}
