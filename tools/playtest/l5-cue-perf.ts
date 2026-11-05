/** Matched cue-active / silent frames in one stationary L5 run; launch under quiet-run. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';

const out = 'test-results/l5-visual-cue'; mkdirSync(out, { recursive: true });
const session = new SceneSession({ backend: 'webgpu', tier: 'low', query: { ui: '1', loadProfile: '2' } });
try {
  await session.open(); await session.page.evaluate('window.__name = f => f');
  const result = await session.page.evaluate(async () => {
    const a = window.__SS__!, game = (window.__SCENE__ as unknown as { game: Game }).game;
    a.settings.set({ quality: 'low', muted: true }); await a.loadLevel('L5', { seed: 1 });
    a.pause(); const loaded = { ...a.perf().nodeBuildMaterials };
    a.missions.begin(); game.ui.show(null);
    document.documentElement.setAttribute('data-scene-hud', ''); document.querySelector('.hud')!.setAttribute('data-scene-hud', '');
    a.missions.completeObjective('emerge'); await a.step(11 * 60);
    const mission = game.world.missions!, ring = mission.def.anchors['l5-ring-rosa'];
    const controller = mission.l5 as unknown as { find(row: NonNullable<typeof mission.state.l5>['survivors'][number]): void };
    const group = mission.state.l5!.survivors.filter(row => row.key !== 'rosa');
    a.teleport(1, { x: ring.x + 15, z: ring.z });
    for (const [i, row] of group.entries()) { controller.find(row); a.teleport(row.id, { x: ring.x + 15 + i * .7, z: ring.z + 3 }); }
    a.camera.follow(); a.camera.zoom(1.5); await a.step(60); await a.screenshotReady();
    const warm = { ...a.perf().nodeBuildMaterials }, cue = document.querySelector<HTMLElement>('[data-testid=survivor-world-cue]')!;
    const frames: { ms: number; active: boolean; tick: number }[] = [];
    a.resume();
    await new Promise<void>(resolve => {
      const start = performance.now(); let previous = 0, previousActive = false;
      const sample = (now: number) => {
        const active = !cue.hidden;
        if (previous && now - start > 2000 && active === previousActive) frames.push({ ms: now - previous, active, tick: a.tick() });
        previous = now; previousActive = active;
        if (now - start < 60_000) requestAnimationFrame(sample); else resolve();
      }; requestAnimationFrame(sample);
    });
    a.pause();
    const stats = (active: boolean) => {
      const samples = frames.filter(f => f.active === active).map(f => f.ms).sort((a, b) => a - b);
      return { count: samples.length, max: samples.at(-1)!, p95: samples[Math.floor(samples.length * .95)], p99: samples[Math.floor(samples.length * .99)] };
    };
    const after = { ...a.perf().nodeBuildMaterials };
    return { backend: a.getState().render.backend, quality: a.getState().render.quality,
      active: stats(true), silent: stats(false),
      buildsSinceLoad: Object.entries(after).filter(([key, n]) => n !== loaded[key]),
      buildsDuringMeasurement: Object.entries(after).filter(([key, n]) => n !== warm[key]), frames };
  });
  writeFileSync(`${out}/performance.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ ...result, frames: result.frames.length }));
  assert.equal(result.backend, 'webgpu'); assert.equal(result.quality, 'low');
  assert(result.active.count > 500 && result.silent.count > 500);
  assert.deepEqual(result.buildsSinceLoad, [], 'no new shader/material builds after L5 load');
  assert(result.active.max <= result.silent.max, 'cue frame maximum must be no worse than silent frames');
  assert.deepEqual(session.errors, []);
} finally { await session.close(); stopServer(); }
