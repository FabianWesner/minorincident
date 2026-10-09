import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { SceneSession, readSpec, stopServer, thumbnail, writeJson, type Backend } from './session';
import type { ActorSpec, PropSpec, SceneSpec } from '../../src/debug/scenelab/spec';

/**
 * Scene Lab MCP server (stdio): `npm run scene:mcp`. One headless browser session, opened on the first scene call and
 * closed after SCENE_MCP_IDLE seconds without calls (default 300), so the machine-wide e2e browser lock is only held
 * while an agent is actually working. Outputs go to test-results/scenes/mcp/. All logging goes to stderr.
 */
const log = (line: string) => process.stderr.write(`[scene-mcp] ${line}\n`);
const out = resolve(process.env.SCENE_MCP_OUT ?? 'test-results/scenes/mcp');
const idleSeconds = Number(process.env.SCENE_MCP_IDLE ?? 300);
let session: SceneSession | null = null, lock: ChildProcess | null = null, idle: NodeJS.Timeout | null = null, shots = 0;
let options: { backend: Backend; tier: 'high' | 'low' } = { backend: 'webgl2', tier: 'high' };

/** Hold the shared browser lock (tools/e2e-lock.sh) through a child that waits on stdin; releasing = closing stdin. */
async function acquireLock(): Promise<void> {
  if (lock || process.env.MI_E2E_LOCK_HELD) return;
  log('waiting for the e2e browser lock');
  const child = spawn('sh', ['tools/e2e-lock.sh', 'sh', '-c', 'echo locked; cat >/dev/null'], { stdio: ['pipe', 'pipe', 'inherit'] });
  await new Promise<void>((done, fail) => { child.stdout!.once('data', () => done()); child.once('exit', code => fail(new Error(`e2e lock exited ${code}`))); });
  lock = child;
}
function releaseLock(): void { lock?.stdin?.end(); lock = null; }
async function close(): Promise<void> { if (idle) clearTimeout(idle); idle = null; const s = session; session = null; await s?.close(); stopServer(); releaseLock(); }
async function ensure(): Promise<SceneSession> {
  if (idle) clearTimeout(idle);
  idle = setTimeout(() => { log('idle: closing the browser'); void close(); }, idleSeconds * 1000);
  if (session) return session;
  await acquireLock();
  const s = new SceneSession({ ...options, log });
  await s.open(); session = s; return s;
}
const text = (data: unknown) => ({ content: [{ type: 'text' as const, text: typeof data === 'string' ? data : JSON.stringify(data, null, 2) }] });
const call = <A,>(fn: (s: SceneSession, args: A) => Promise<unknown>) => async (args: A) => {
  try { const s = await ensure(); const errors = s.errors.length; const result = await fn(s, args); const fresh = s.errors.slice(errors); return text(fresh.length ? { result, consoleErrors: fresh } : result); }
  catch (error) { return { ...text(String(error instanceof Error ? error.message : error)), isError: true }; }
};
const page = (s: SceneSession) => s.page;
const point = z.tuple([z.number(), z.number()]);
const anyJson = z.any();

const server = new McpServer({ name: 'minor-incident-scene-lab', version: '1.0.0' }, {
  instructions: 'Scene Lab for Minor Incident QA: compose an isolated scene from real game content (load_scene with a spec, or a path to specs/scenes/*.json), add actors, step fixed 60 Hz frames, then screenshot / metrics / clipping. Spec format: docs/tools/scene-lab.md.',
});
server.registerTool('load_scene', { description: 'Load a scene from a spec object or a JSON path (e.g. specs/scenes/bench-sitter.json). Replaces the current scene. Optional backend/tier reopen the browser. Returns placement and actor ids.',
  inputSchema: { spec: anyJson.optional(), path: z.string().optional(), backend: z.enum(['webgl2', 'webgpu']).optional(), tier: z.enum(['high', 'low']).optional() } },
async ({ spec, path, backend, tier }) => {
  if ((backend && backend !== options.backend) || (tier && tier !== options.tier)) { await close(); options = { backend: backend ?? options.backend, tier: tier ?? options.tier }; }
  return call<SceneSpec>((s, v) => s.load(v))((path ? readSpec(resolve(path)) : spec ?? {}) as SceneSpec);
});
server.registerTool('inspect_level', { description: 'Run a real registered level with normal sim and a detached camera. Returns anchors. bot=true drives the existing complete profile; otherwise courier is a ghost.', inputSchema: { level: z.string(), bot: z.boolean().optional() } },
call((s, { level, bot }: { level: string; bot?: boolean }) => s.inspectLevel(level, bot)));
server.registerTool('inspect_camera', { description: 'Fly to a position/target, jump to an anchor, follow a numeric entity id, or set time scale (0 pauses). Operates on the running real level.', inputSchema: { position: z.tuple([z.number(), z.number(), z.number()]).optional(), target: z.tuple([z.number(), z.number(), z.number()]).optional(), anchor: z.string().optional(), follow: z.number().nullable().optional(), timeScale: z.number().min(0).max(20).optional(), lod: z.enum(['game', 'real']).optional() } },
call((s, args) => page(s).evaluate(a => { const inspect = window.__SS__!.inspect; if (a.position && a.target) inspect.setCamera({ position: a.position, target: a.target }); if (a.anchor) inspect.jump(a.anchor); if (a.follow !== undefined) inspect.follow(a.follow); if (a.timeScale !== undefined) inspect.timeScale(a.timeScale); if (a.lod) inspect.lod(a.lod); return inspect.state(); }, args)));
server.registerTool('inspect_state', { description: 'Running level camera, anchors, entity snapshots and renderer counters.' },
call(s => page(s).evaluate(() => ({ ...window.__SS__!.inspect.state(), anchors: window.__SS__!.inspect.anchors(), entities: window.__SS__!.query({}) }))));
server.registerTool('place', { description: 'Add a static prop by manifest id (e.g. bld.house-a, prop.bench). Reloads the scene (static batches and collision are baked at load), so the frame counter resets.',
  inputSchema: { asset: z.string(), at: z.union([point, z.tuple([z.number(), z.number(), z.number()])]), yaw: z.number().optional().describe('degrees'), scale: z.number().optional(), id: z.string().optional(), tint: z.string().optional() } },
call((s, prop: PropSpec) => page(s).evaluate(p => window.__SCENE__!.place(p), prop)));
server.registerTool('spawn_actor', { description: 'Spawn courier | pedestrian | infected | corgi into the running scene. look: {model, tint, accessories, handProp, tier}; state: an action (see command).',
  inputSchema: { kind: z.enum(['courier', 'pedestrian', 'infected', 'corgi']), id: z.string().optional(), at: point.optional(), yaw: z.number().optional(), look: anyJson.optional(), archetype: z.string().optional(), count: z.number().int().optional(), spread: z.number().optional(), state: anyJson.optional(), loadout: z.tuple([z.string(), z.string()]).optional() } },
call((s, actor: ActorSpec) => page(s).evaluate(a => window.__SCENE__!.spawnActor(a), actor)));
server.registerTool('command', { description: 'Give an actor an action: "idle" | "chase" | "flee" | "infect" | {walk:[[x,z]..],loop?} | {run:[[x,z]..]} | {moveTo:[x,z],pace?} | {turn:deg} | {sit:"<placement id or asset id>"} | {attack:"<actor id>",seconds?} | {hit:{from?,heavy?}} | {infect:{by?,instant?}} | {mountBike:"<vehicle id>"} | {dismount:true}. Effects: actor "fx" with {blast:id,at} | {wreck:vehicleId} | {fire:[x,z]} | {smoke:[x,z]}.',
  inputSchema: { actor: z.string(), action: anyJson } },
call((s, { actor, action }: { actor: string; action: unknown }) => page(s).evaluate(([id, a]) => { const lab = window.__SCENE__!; if (id === 'fx') lab.effect(a as never); else lab.command(id as string, a as never); return lab.describe(); }, [actor, action] as const)));
server.registerTool('step', { description: 'Advance N fixed 60 Hz frames (sim + render), recording metrics. Returns the frame counter.', inputSchema: { frames: z.number().int().min(1).max(3600) } },
call((s, { frames }: { frames: number }) => s.step(frames)));
server.registerTool('set_time', { description: 'Lighting preset: L1 (game morning), L2, L3, L4/golden, L5, L6, night.', inputSchema: { preset: z.string() } },
call((s, { preset }: { preset: string }) => page(s).evaluate(p => { window.__SCENE__!.setTime(p as never); return p; }, preset)));
server.registerTool('set_camera', { description: 'Camera: {mode:"game",target?,zoom?} | {mode:"follow",actor,zoom?} | {mode:"close",target,radius?,azimuth?} | {mode:"orbit",target,radius?,azimuth?,polar?,spin?} | {mode:"pose",position,target}. target = [x,z], [x,y,z] or an actor id.',
  inputSchema: { camera: anyJson } },
call((s, { camera }: { camera: unknown }) => page(s).evaluate(c => { window.__SCENE__!.setCamera(c as never); return c; }, camera)));
server.registerTool('screenshot', { description: 'Screenshot after streaming settles. Returns the PNG path plus a small inline thumbnail.', inputSchema: { name: z.string().optional() } },
async ({ name }) => {
  try {
    const s = await ensure(), path = `${out}/${name ?? `shot-${String(++shots).padStart(3, '0')}`}.png`;
    const png = await s.screenshot(path);
    return { content: [{ type: 'text' as const, text: JSON.stringify({ path, frame: await page(s).evaluate(() => window.__SCENE__?.frame ?? window.__SS__!.tick()) }) }, { type: 'image' as const, data: thumbnail(png).toString('base64'), mimeType: 'image/png' }] };
  } catch (error) { return { ...text(String(error)), isError: true }; }
});
server.registerTool('metrics', { description: 'Per-actor foot slide / yaw drift / torso pitch / lift / sink, LOD use, draw calls and triangles, visible-vs-sim counts, vehicle state, console errors. Also written to test-results/scenes/mcp/metrics.json.' },
call(async s => { const m = { ...(await s.metrics()), consoleErrors: s.errors }; writeJson(`${out}/metrics.json`, m); return m; }));
server.registerTool('clipping', { description: 'Clipping report: static mesh pairs (placement vs placement, triangle intersections) and actor bones piercing or sinking into props (names, bone, frame, clearance).' },
call(s => s.clipping()));
server.registerTool('describe', { description: 'Current scene: placement ids, actor ids, vehicle ids, frame.' }, call(s => s.describe()));
server.registerTool('reset', { description: 'Reload the current scene spec (including spawned actors and placed props) at frame 0.' },
call(s => page(s).evaluate(() => window.__SCENE__!.reset())));
server.registerTool('close', { description: 'Close the browser and release the e2e lock now (it also closes itself when idle).' }, async () => { await close(); return text('closed'); });

if (!existsSync('package.json')) log('warning: run from the repository root (paths are relative to it)');
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => { void close().finally(() => process.exit(0)); });
process.stdin.on('close', () => { void close().finally(() => process.exit(0)); });
await server.connect(new StdioServerTransport());
log('ready');
