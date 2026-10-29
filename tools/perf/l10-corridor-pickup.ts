/** Q-227: actual L10 mission, high tier, device clicks through the R5/R6 seam and E to collect the rocket launcher.
 * SCENE_SERVER=preview SCENE_PORT=4737 sh tools/perf/quiet-run.sh npx tsx tools/perf/l10-corridor-pickup.ts --timing
 */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';
const timing = process.argv.includes('--timing');
if (timing && !process.env.MI_BROWSER_POOL_EXCLUSIVE && process.env.MI_PERF_LOCK_HELD !== '1') throw Error('Use tools/perf/quiet-run.sh');
const out = process.env.L10_PICKUP_OUT ?? 'test-results/l10-perf/corridor'; mkdirSync(out, { recursive: true });
const session = new SceneSession({ backend: 'webgpu', tier: 'high', nativeFrameTiming: timing, viewport: { width: 1600, height: 900 }, query: { loadProfile: '2' } });
try {
  await session.open();
  await session.page.evaluate('globalThis.__name = fn => fn');
  await session.page.evaluate(async () => {
    const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
    // Resume the preceding mission checkpoint and stage its approach before view loading/warm-up, so R6's first
    // camera entry and its pickup are measured. No post-load teleport or screenshot-ready drain prewarms the corridor.
    await g.loadLevel('L10', { seed: 1, checkpoint: 'cure-research', setup: world => {
      const p = world.entities.get(1)!;
      if (!world.solids.relocate(p, { x: 2910, z: -5, y: .72 }, 'scripted.teleport', 1.5, false)) throw Error('Corridor approach is blocked');
      world.previousPlayer = { ...p.transform }; world.physics.playerBody!.setTranslation(p.transform, true);
    } });
    a.pause(); a.cheats.god(true); g.ui.show(null); a.camera.zoom(1.5);
    const trace = window as unknown as { pickupTrace: { frames: object[]; running: boolean; loaded: Record<string, number>; startTick: number } };
    trace.pickupTrace = { frames: [], running: true, loaded: { ...g.view.renderer.nodeBuildMaterials }, startTick: a.tick() };
    let last = performance.now();
    const sample = (now: number) => {
      const p = g.world.entities.get(1)!.transform;
      trace.pickupTrace.frames.push({ ms: now - last, tick: g.world.tick, x: p.x, z: p.z, builds: g.view.renderer.nodeBuilds, update: g.view.updateCpuMs, render: g.view.renderCpuMs }); last = now;
      if (trace.pickupTrace.running) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample); a.resume();
  });
  for (const x of [2918, 2927, 2937]) {
    const point = await session.page.evaluate(x => window.__SS__!.input.project({ x, z: -5 }), x);
    await session.page.mouse.click(point.x, point.y);
    await session.page.waitForFunction(x => {
      const p = window.__SS__!.getEntity(1)!.transform; return Math.hypot(p.x - x, p.z + 5) < 1.2;
    }, x, { timeout: 30_000, polling: 100 });
  }
  await session.page.keyboard.down('e'); await session.page.waitForTimeout(1000); await session.page.keyboard.up('e');
  await session.page.keyboard.press('7'); await session.page.waitForTimeout(1500);
  const result = await session.page.evaluate(() => {
    const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
    const trace = (window as unknown as { pickupTrace: { frames: { ms: number }[]; running: boolean; loaded: Record<string, number>; startTick: number } }).pickupTrace;
    trace.running = false; a.pause();
    const after = { ...g.view.renderer.nodeBuildMaterials }, heldBuilds = Object.entries(after).filter(([key, n]) => key.startsWith('action-held:') && n !== trace.loaded[key]);
    const frames = trace.frames.map(f => f.ms).sort((a, b) => a - b);
    return { ...trace, after, heldBuilds, backend: a.perf().backend, quality: a.getState().render.quality, player: a.getEntity(1), actions: a.getState().render.actions,
      pickup: a.events(trace.startTick).filter(e => e.type === 'pickup.collected' && 'actionId' in e && e.actionId === 'weapon.rocket-launcher'),
      max: Math.max(...frames), p95: frames[Math.ceil(frames.length * .95) - 1], hitches: trace.frames.filter(f => f.ms > 200) };
  });
  await session.screenshot(`${out}/pickup.png`);
  writeFileSync(`${out}/evidence.json`, JSON.stringify({ timing, ...result, errors: session.errors }, null, 2));
  console.log(JSON.stringify({ timing, frames: result.frames.length, max: result.max, p95: result.p95, pickup: result.pickup, heldBuilds: result.heldBuilds, errors: session.errors }));
  assert.equal(result.backend, 'webgpu'); assert.equal(result.quality, 'high'); assert.equal(result.pickup.length, 1);
  assert.deepEqual(result.heldBuilds, []); assert.deepEqual(session.errors, []);
  if (timing) assert.deepEqual(result.hitches, [], 'No frame over 200 ms through the corridor pickup');
} finally { await session.close(); stopServer(); }
