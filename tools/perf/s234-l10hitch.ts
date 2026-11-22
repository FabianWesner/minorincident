/** Trace the L10 opening hitch from the PO's cure-crash checkpoint.
 * Run through tools/perf/quiet-run.sh with SCENE_PORT=5264.
 */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { SceneSession, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';
import type { InputFrame } from '../../src/input/InputFrame';

const backend = (process.argv[2] ?? 'webgpu') as 'webgpu' | 'webgl2';
const tier = (process.argv[3] ?? 'high') as 'high' | 'low';
const label = process.argv[4] ?? 'before';
const combat = process.env.S234_COMBAT === '1';
const replay = JSON.parse(gunzipSync(readFileSync('tests/fixtures/perf/l10-real-input.json.gz')).toString()) as { inputs: { tick: number; frame: InputFrame }[] };
const frames: InputFrame[] = []; let cursor = 0;
for (let tick = 0; tick < 900; tick++) {
  while (cursor + 1 < replay.inputs.length && replay.inputs[cursor + 1].tick <= tick) cursor++;
  frames.push(structuredClone(replay.inputs[cursor].frame));
}
const out = `test-results/s234-l10hitch/${label}-${backend}-${tier}`;
mkdirSync(out, { recursive: true });
const session = new SceneSession({ backend, tier, seed: 1, nativeFrameTiming: process.env.S194_DIAGNOSTIC !== '1', viewport: { width: 1600, height: 900 }, query: { loadProfile: '2' } });
try {
  await session.open();
  await session.page.mouse.click(10, 10);
  await session.page.evaluate('globalThis.__name = fn => fn');
  await session.page.evaluate(async ({ frames, diagnostic, combat }) => {
    const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
    await a.loadLevel('L10', { seed: 1, checkpoint: 'cure-crash' });
    a.pause(); a.cheats.god(true); a.camera.follow(); a.debug.cpuProfile();
    await g.audio.unlock();
    if (g.world.missions?.state.phase === 'briefing') g.world.missions.begin();
    let cursor = 0;
    const feed: NonNullable<Game['input']['feed']> = { scheme: 'mouse-only', next: () => {
      const frame = frames[cursor++];
      feed.scheme = frame?.drive ? frame.aimSource === 'pointer' ? 'mouse-keyboard' : 'keyboard' : 'mouse-only';
      return frame ?? null;
    } };
    if (combat) {
      const modulePath = '/src/debug/bot/LevelTenBot.ts';
      const module = await import(/* @vite-ignore */ modulePath);
      g.driver = new module.LevelTenBot(g.world, 'complete');
    } else g.input.feed = feed;
    const trace = window as unknown as { hitchTrace: { frames: { at: number; dt: number; tick: number; x: number; z: number; builds: number; builtMaterials: Record<string, number>; buildObjects: Record<string, string>; infected: number; alive: number; sim: number; update: number; render: number; categories: Record<string, number> }[]; running: boolean } };
    trace.hitchTrace = { frames: [], running: true };
    let previousMaterials = { ...g.view.renderer.nodeBuildMaterials };
    let last = performance.now();
    const sample = (now: number) => {
      const infected = g.world.infected?.active ?? [];
      const p = g.world.entities.get(1)!.transform;
      const materials = { ...g.view.renderer.nodeBuildMaterials };
      const builtMaterials = Object.fromEntries(Object.entries(materials).filter(([name, count]) => count > (previousMaterials[name] ?? 0)).map(([name, count]) => [name, count - (previousMaterials[name] ?? 0)]));
      const ids = new Set(Object.keys(builtMaterials).map(name => Number(/:o(\d+)$/.exec(name)?.[1])));
      const buildObjects: Record<string, string> = {};
      if (diagnostic && ids.size) g.view.scene.traverse(object => { if (ids.has(object.id)) {
        const path: string[] = []; for (let node: typeof object | null = object; node; node = node.parent) path.unshift(node.name || node.type);
        const geometry = Reflect.get(object, 'geometry') as { type?: string } | undefined;
        buildObjects[object.id] = `${path.join('/')} geometry=${geometry?.type ?? 'none'}`;
      } });
      previousMaterials = materials;
      trace.hitchTrace.frames.push({ at: now, dt: now - last, tick: g.world.tick, x: p.x, z: p.z, builds: g.view.renderer.nodeBuilds, builtMaterials, buildObjects, infected: infected.length,
        alive: infected.filter(e => e.health.current > 0).length, sim: a.perf().simMs, update: a.perf().updateCpuMs,
        render: a.perf().renderCpuMs, categories: a.debug.cpuProfile() });
      last = now;
      if (trace.hitchTrace.running) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample); a.resume();
  }, { frames, diagnostic: process.env.S194_DIAGNOSTIC === '1', combat });
  await session.page.waitForFunction(() => window.__SS__!.tick() >= 900, null, { timeout: 180_000, polling: 20 });
  const result = await session.page.evaluate(() => {
    const trace = window as unknown as { hitchTrace: { frames: { at: number; dt: number; tick: number; infected: number; alive: number; builtMaterials: Record<string, number>; sim: number; update: number; render: number; categories: Record<string, number> }[]; running: boolean } };
    trace.hitchTrace.running = false; window.__SS__!.pause();
    const frames = trace.hitchTrace.frames;
    const sorted = frames.map(f => f.dt).sort((a,b)=>a-b);
    const game = (window.__SCENE__ as unknown as { game: Game }).game;
    return { backend: window.__SS__!.perf().backend, tier: window.__SS__!.getState().render.quality, checkpoint: game.world.missions?.state.checkpoint,
      frames, max: Math.max(...sorted), p99: sorted[Math.ceil(sorted.length*.99)-1], hitches: frames.filter(f=>f.dt>100), errors: [] as string[] };
  });
  result.errors = session.errors;
  const segment = result.frames.filter(f => f.tick >= 400 && f.tick <= 900);
  const sortedSegment = segment.map(f => f.dt).sort((a,b) => a-b);
  const p99Segment = sortedSegment[Math.ceil(sortedSegment.length * .99) - 1] ?? 0;
  const worst = [...segment].sort((a,b)=>b.dt-a.dt).slice(0,12);
  const summary = { ...result, window: { firstTick: 400, lastTick: 900, frames: segment.length, p99: p99Segment,
    max: sortedSegment.at(-1) ?? 0, over33: segment.filter(f => f.dt > 33).length,
    over50: segment.filter(f => f.dt > 50).length, worst } };
  writeFileSync(`${out}/trace.json`, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ backend: result.backend, tier: result.tier, samples: result.frames.length, window: summary.window, errors: result.errors }, null, 2));
  assert.equal(result.backend, backend === 'webgpu' ? 'webgpu' : 'webgl');
  assert.equal(result.tier, tier);
  assert.equal(result.checkpoint, 'cure-crash');
  assert.ok(segment.some(f => f.alive >= 1), 'trace window must include infected');
  if (process.env.S194_ASSERT_WARM === '1') {
    const first = result.frames.findIndex(f => f.alive > 0);
    assert.deepEqual(result.frames[first].builtMaterials, {}, 'first infected frame must not build materials');
  }
  assert.deepEqual(result.errors, []);
} finally { await session.close(); stopServer(); }
