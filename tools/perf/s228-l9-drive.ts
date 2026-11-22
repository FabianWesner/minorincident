/** Native WebGPU L9 drive hitch trace around the PO's reported tick/position.
 * Run through tools/perf/quiet-run.sh with SCENE_PORT=5252. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';

interface TraceFrame { at: number; dt: number; tick: number; x: number; z: number; alive: number; sim: number; update: number; render: number; builds: number; draws: number; triangles: number; chunks: number; corpses: number }
interface TraceResult { backend: string; tier: string; tick: number; frames: TraceFrame[]; p95: number; p99: number; max: number; hitches: TraceFrame[]; errors: string[] }

const label = process.argv[2] ?? 'before';
const out = `test-results/s228-l9perf/${label}`;
mkdirSync(out, { recursive: true });
const session = new SceneSession({ backend: 'webgpu', tier: 'high', seed: 1, nativeFrameTiming: true, viewport: { width: 1600, height: 900 } });
try {
  await session.open();
  await session.page.evaluate('globalThis.__name = fn => fn');
  await session.page.evaluate(async () => {
    const a = window.__SS__!;
    const g = (window.__SCENE__ as unknown as { game: Game }).game;
    await a.loadLevel('L9', { seed: 1, progression: 'L9-default' });
    a.pause(); a.camera.follow(); a.camera.zoom(1.5);
    const modulePath = '/src/debug/bot/LevelNineBot.ts';
    const module = await import(/* @vite-ignore */ modulePath);
    g.driver = new module.LevelNineBot(g.world, 'dry-shortcut', true, .7, 'complete');
    if (g.world.missions!.state.phase === 'briefing') g.world.missions!.begin();
    const trace = window as unknown as { l9Trace: { frames: TraceFrame[]; running: boolean } };
    trace.l9Trace = { frames: [], running: true };
    let last = performance.now();
    const sample = (now: number) => {
      const p = a.perf(), world = g.world, car = world.entities.get(world.missions!.l9!.state.carId)!;
      let alive = -1, corpses = -1;
      if (world.tick % 60 === 0) {
        alive = 0; for (const e of world.infected!.active) if (e.health.current > 0 && !e.hidden) alive++;
        corpses = 0; for (const e of world.entities.iterate()) if (e.corpse) corpses++;
      }
      trace.l9Trace.frames.push({ at: now, dt: now - last, tick: world.tick, x: car.transform.x, z: car.transform.z, alive,
        sim: p.simMs, update: p.updateCpuMs, render: p.renderCpuMs, builds: p.nodeBuilds, draws: p.drawCalls, triangles: p.triangles,
        chunks: p.chunkResidency?.resident ?? 0, corpses });
      last = now;
      if (trace.l9Trace.running && world.tick < 9000) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample); a.resume();
  });
  await session.page.waitForFunction(() => window.__SS__!.tick() >= 9000, null, { timeout: 240_000, polling: 20 });
  const result: TraceResult = await session.page.evaluate(() => {
    const trace = window as unknown as { l9Trace: { frames: TraceFrame[]; running: boolean } };
    trace.l9Trace.running = false; window.__SS__!.pause();
    const frames = trace.l9Trace.frames, sorted = frames.map(f => f.dt).sort((a, b) => a - b);
    const pct = (p: number) => sorted[Math.ceil(sorted.length * p) - 1] ?? 0;
    const game = (window.__SCENE__ as unknown as { game: Game }).game;
    return { backend: window.__SS__!.perf().backend, tier: window.__SS__!.getState().render.quality, tick: game.world.tick, frames,
      p95: pct(.95), p99: pct(.99), max: sorted.at(-1) ?? 0, hitches: frames.filter(f => f.dt > 33.4), errors: [] as string[] };
  });
  result.errors = session.errors;
  writeFileSync(`${out}/trace.json`, JSON.stringify(result, null, 2));
  const segment = result.frames.filter(f => f.tick >= 6500 && f.tick <= 8200), sorted = segment.map(f => f.dt).sort((a,b)=>a-b);
  const pct = (p: number) => sorted[Math.ceil(sorted.length*p)-1] ?? 0;
  const worst = [...segment].sort((a,b)=>b.dt-a.dt).slice(0, 10);
  console.log(JSON.stringify({ backend: result.backend, tier: result.tier, tick: result.tick, frames: segment.length,
    p95: pct(.95), p99: pct(.99), max: sorted.at(-1) ?? 0, hitches: segment.filter(f => f.dt > 33.4).length, worst, errors: result.errors }, null, 2));
  assert.equal(result.backend, 'webgpu'); assert.equal(result.tier, 'high'); assert.deepEqual(result.errors, []);
  assert.ok(segment.some(f => Math.abs(f.x - 272.45) < 40 && Math.abs(f.z + 28.15) < 30), 'trace must cross near reported PO position');
} finally { await session.close(); stopServer(); }
