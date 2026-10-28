/** Exercise L3's yard, streamed avenues and highway shadows with ordinary bot input.
 * This checks rendering through the corridor; it is not a mission-completion test. */
import assert from 'node:assert/strict';
import { SceneSession, stopServer, writeJson } from './session';

const tier = process.env.REVIEW_TIER === 'low' ? 'low' : 'high';
const backend = process.env.REVIEW_BACKEND === 'webgl2' ? 'webgl2' : 'webgpu';
const session = new SceneSession({ tier, backend, query: { loadProfile: '2', crowdProbe: 'drawn' } });
try {
  await session.open();
  const result = await session.page.evaluate(async () => {
    const api = window.__SS__!;
    await api.loadLevel('L3', { seed: 1, checkpoint: 'armory', progression: 'L3-default' });
    api.pause(); api.cheats.god(true); await api.screenshotReady();
    const warm = api.perf().nodeBuilds, materials = { ...api.perf().nodeBuildMaterials }, start = api.tick(), frames = api.perf().renderedFrames;
    let phase = api.missions.state()!.phase;
    api.bot.start('complete');
    while (api.tick() - start < 36000 && !['result', 'progression'].includes(phase)) {
      // Beginning a mission can resume the game clock. Keep explicit stepping
      // authoritative while allowing a real browser frame between samples.
      api.pause();
      await api.step(60);
      api.pause();
      phase = api.missions.state()!.phase;
      if (!['result', 'progression'].includes(phase)) await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    }
    // Capture the completed mission before the next RAF navigates to L4.
    api.bot.stop(); if (!['result', 'progression'].includes(phase)) await api.screenshotReady();
    return { start, tick: api.tick(), renderedFrames: api.perf().renderedFrames - frames, phase: api.missions.state()!.phase, l3: api.missions.state()!.l3,
      backend: api.perf().backend, lateBuilds: api.perf().nodeBuilds - warm,
      builds: Object.entries(api.perf().nodeBuildMaterials).filter(([key, count]) => count > (materials[key] ?? 0)), perf: api.perf() };
  });
  const out = `test-results/q212-load/freeze-L3-${tier}-${backend}`;
  writeJson(`${out}/result.json`, { tier, backend, result, errors: session.errors });
  await session.screenshot(`${out}/finish.png`);
  assert.deepEqual(session.errors, []); assert.ok(result.l3!.furthest > 160, 'must traverse the streamed avenues to the highway approach');
  assert.ok(result.renderedFrames >= Math.floor((result.tick - result.start) / 60), 'render every one-second simulation step'); assert.equal(result.lateBuilds, 0);
  console.log(JSON.stringify({ tier, backend, ticks: result.tick - result.start, phase: result.phase, lateBuilds: result.lateBuilds }));
} finally { await session.close(); stopServer(); }
