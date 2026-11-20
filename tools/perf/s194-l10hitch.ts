/** Trace the first L10 outbreak from the PO's cure-crash checkpoint.
 * Run with: E2E_UNITS=1 SCENE_PORT=5144 sh tools/e2e-lock.sh npx tsx tools/perf/s194-l10hitch.ts webgpu high before
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
const replay = JSON.parse(gunzipSync(readFileSync('tests/fixtures/perf/l10-real-input.json.gz')).toString()) as { inputs: { tick: number; frame: InputFrame }[] };
const frames: InputFrame[] = []; let cursor = 0;
for (let tick = 0; tick < 600; tick++) {
  while (cursor + 1 < replay.inputs.length && replay.inputs[cursor + 1].tick <= tick) cursor++;
  frames.push(structuredClone(replay.inputs[cursor].frame));
}
const out = `test-results/s194-l10hitch/${label}-${backend}-${tier}`;
mkdirSync(out, { recursive: true });
const session = new SceneSession({ backend, tier, seed: 1, nativeFrameTiming: process.env.S194_DIAGNOSTIC !== '1', viewport: { width: 1600, height: 900 }, query: { loadProfile: '2' } });
try {
  await session.open();
  await session.page.evaluate('globalThis.__name = fn => fn');
  await session.page.evaluate(async frames => {
    const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
    await a.loadLevel('L10', { seed: 1, checkpoint: 'cure-crash' });
    a.pause(); a.cheats.god(true); a.camera.follow(); a.debug.cpuProfile();
    if (g.world.missions?.state.phase === 'briefing') g.world.missions.begin();
    let cursor = 0;
    const feed: NonNullable<Game['input']['feed']> = { scheme: 'mouse-only', next: () => {
      const frame = frames[cursor++];
      feed.scheme = frame?.drive ? frame.aimSource === 'pointer' ? 'mouse-keyboard' : 'keyboard' : 'mouse-only';
      return frame ?? null;
    } };
    g.input.feed = feed;
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
      if (ids.size) g.view.scene.traverse(object => { if (ids.has(object.id)) {
        const path: string[] = []; for (let node: typeof object | null = object; node; node = node.parent) path.unshift(node.name || node.type);
        buildObjects[object.id] = path.join('/');
      } });
      previousMaterials = materials;
      trace.hitchTrace.frames.push({ at: now, dt: now - last, tick: g.world.tick, x: p.x, z: p.z, builds: g.view.renderer.nodeBuilds, builtMaterials, buildObjects, infected: infected.length,
        alive: infected.filter(e => e.health.current > 0).length, sim: a.perf().simMs, update: a.perf().updateCpuMs,
        render: a.perf().renderCpuMs, categories: a.debug.cpuProfile() });
      last = now;
      if (trace.hitchTrace.running) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample); a.resume();
  }, frames);
  await session.page.waitForFunction(() => window.__SS__!.tick() >= 600, null, { timeout: 120_000, polling: 20 });
  const result = await session.page.evaluate(() => {
    const trace = window as unknown as { hitchTrace: { frames: { at: number; dt: number; tick: number; infected: number; alive: number; sim: number; update: number; render: number; categories: Record<string, number> }[]; running: boolean } };
    trace.hitchTrace.running = false; window.__SS__!.pause();
    const frames = trace.hitchTrace.frames;
    const sorted = frames.map(f => f.dt).sort((a,b)=>a-b);
    const game = (window.__SCENE__ as unknown as { game: Game }).game;
    return { backend: window.__SS__!.perf().backend, tier: window.__SS__!.getState().render.quality, checkpoint: game.world.missions?.state.checkpoint,
      frames, max: Math.max(...sorted), p99: sorted[Math.ceil(sorted.length*.99)-1], hitches: frames.filter(f=>f.dt>100), errors: [] as string[] };
  });
  result.errors = session.errors;
  writeFileSync(`${out}/trace.json`, JSON.stringify(result, null, 2));
  const worst = [...result.hitches].sort((a,b)=>b.dt-a.dt)[0];
  console.log(JSON.stringify({ backend: result.backend, tier: result.tier, samples: result.frames.length, max: result.max, p99: result.p99, worst, hitches: result.hitches.length, errors: result.errors }, null, 2));
  assert.equal(result.backend, backend === 'webgpu' ? 'webgpu' : 'webgl');
  assert.deepEqual(result.errors, []);
} finally { await session.close(); stopServer(); }
