import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { chromium, type Page } from '@playwright/test';

/**
 * Crowd footwork evidence: actual renderer and game camera angle at a close review radius, every sim tick
 * presented at 60 Hz, captured at 20 fps (small WebM + PNG stills), plus an in-game ankle probe of every
 * close figure. Run through tools/e2e-lock.sh on a dedicated preview port (never 3300).
 *   npx tsx tools/crowdfoot/capture.ts <out> <tag> [--port=3392] [--root=<dir with dist>]
 */
const [out = 'test-results/crowd-footwork', tag = 'after'] = process.argv.slice(2).filter(a => !a.startsWith('--'));
const arg = (name: string, fallback: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const port = Number(arg('port', '3392')), root = arg('root', process.cwd()), only = arg('only', '');
if (port === 3300) throw new Error('never use the shared dev-server port');
const origin = `http://127.0.0.1:${port}`;
const ffmpeg = process.env.FFMPEG_BIN ?? `${homedir()}/Library/Caches/ms-playwright/ffmpeg-1011/ffmpeg-mac`;
mkdirSync(out, { recursive: true });

async function up(): Promise<boolean> { try { return (await fetch(origin)).ok; } catch { return false; } }
let server: ChildProcess | undefined;
if (!(await up())) {
  server = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort', '--configLoader', 'runner'], { cwd: root, stdio: 'ignore' });
  for (let i = 0; i < 120 && !(await up()); i++) await new Promise(r => setTimeout(r, 500));
}
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
page.on('pageerror', e => console.error('pageerror', e.message)); page.on('console', m => { if (m.type() === 'log') console.log('page', m.text()); });

type Probe = { id: number; lod?: string; clip: string; drawn: boolean; feet: number[][]; soles?: number[][] };
/** Model-free contact probe per close figure (as tools/playeranim/metrics.ts): a foot is planted while its lowest sole
 * point (heel/toe) is within 1.2 cm of that figure's floor; a planted foot must not slide. Lying/crawling clips excluded. */
function soleMetrics(samples: Probe[][]) {
  const tracks = new Map<string, { clip: string; heel: number[]; toe: number[] }[]>();
  samples.forEach(frame => frame.forEach(f => {
    if (!f.drawn || f.lod === 'lod2' || !f.soles || f.soles.length < 4) return;
    for (let i = 0; i < 2; i++) { const key = `${f.id}/${i}`; if (!tracks.has(key)) tracks.set(key, []); tracks.get(key)!.push({ clip: f.clip, heel: f.soles[i * 2], toe: f.soles[i * 2 + 1] }); }
  }));
  const slides: number[] = [];
  for (const track of tracks.values()) {
    if (track.length < 20) continue;
    const floor = Math.min(...track.map(t => Math.min(t.heel[1], t.toe[1])));
    let slide = 0, previous: (typeof track)[number] | undefined;
    for (const t of track) {
      if (/death|knockdown|flung|get-up|crawl|collapse|rise|sit|stand-up|grabbed/.test(t.clip)) { if (previous) slides.push(slide); slide = 0; previous = undefined; continue; }
      if (Math.min(t.heel[1], t.toe[1]) < floor + .012) {
        if (previous) { const toe = t.toe[1] < floor + .012 && previous.toe[1] < floor + .012, a = toe ? t.toe : t.heel, b = toe ? previous.toe : previous.heel; slide += Math.hypot(a[0] - b[0], a[2] - b[2]); }
        previous = t;
      } else { if (previous) slides.push(slide); slide = 0; previous = undefined; }
    }
  }
  slides.sort((a, b) => a - b);
  return { feet: tracks.size, contacts: slides.length, slideP95Cm: slides.length ? +(slides[Math.floor(slides.length * .95)] * 100).toFixed(2) : 0, slideMaxCm: slides.length ? +(slides[slides.length - 1] * 100).toFixed(2) : 0, over3cm: slides.filter(s => s > .03).length };
}

async function frameAt(page: Page, target: number[], r: number) {
  return page.evaluate(async ({ target, r }) => {
    const a = window.__SS__!;
    a.camera.cinematic({ target: [target[0], .7, target[1]], position: [target[0] + r * Math.sin(.3 * Math.PI) / Math.SQRT2, .7 + r * Math.cos(.3 * Math.PI), target[1] + r * Math.sin(.3 * Math.PI) / Math.SQRT2] }, true);
    a.vfx.stepRender(1 / 60); await a.step(1);
    return a.crowdFigures().map(f => ({ id: f.id, lod: f.lod, clip: f.clip, drawn: f.drawn, feet: f.feet, soles: (f as { soles?: number[][] }).soles }));
  }, { target, r });
}

const results: Record<string, unknown> = {};
async function scene(name: string, setup: () => Promise<number[]>, ticks: number, r = 9, each?: (tick: number) => Promise<void>) {
  if (only && !only.split(',').includes(name)) return;
  await page.goto(`${origin}/?test=1&renderer=webgl&dpr=1&quality=high&audio=muted&seed=1`);
  await page.waitForFunction(() => !!window.__SS__, null, { timeout: 120_000 });
  const target = await setup();
  await page.addStyleTag({ content: '.story-bubble,.mission-subtitle,.hud,.toast{visibility:hidden!important}' });
  const frames: Buffer[] = [], probes: Probe[][] = [];
  await frameAt(page, target, r);
  const point =await page.evaluate(t => window.__SS__!.input.project({ x: t[0], z: t[1] }), target);
  const clip = { x: Math.round(Math.max(0, Math.min(1600 - 1280, point.x - 640))), y: Math.round(Math.max(0, Math.min(900 - 720, point.y - 400))), width: 1280, height: 720 };
  for (let tick = 0; tick < ticks; tick++) {
    await each?.(tick);
    probes.push(await frameAt(page, target, r));
    if (tick % 3 === 0) {
      frames.push(await page.screenshot({ type: 'jpeg', quality: 80, clip }));
      if ([90, 300, 540].includes(tick)) await page.screenshot({ path: `${out}/${tag}-${name}-${tick}.png`, clip });
    }
  }
  execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', '20', '-i', 'pipe:0', '-c:v', 'libvpx', '-b:v', '700k', '-crf', '20', `${out}/${tag}-${name}.webm`], { input: Buffer.concat(frames), maxBuffer: 1024 * 1024 });
  results[name] = soleMetrics(probes);
  console.log(tag, name, JSON.stringify(results[name]));
}

// Pedestrians: civ-street routines (walking, waypoint turns), then an infected walks in and they flee.
await scene('pedestrians', async () => page.evaluate(async () => {
  const a = window.__SS__!; await a.ready; await a.loadScenario('civ-street'); a.pause(); a.cheats.god(true);
  a.teleport('player', { x: 14, z: 14 });
  // Four walkers on square routes (90° turns at the corners), one on a back-and-forth line (180° turns).
  const square = [{ x: -3, z: -2.5 }, { x: 3, z: -2.5 }, { x: 3, z: 2.5 }, { x: -3, z: 2.5 }];
  for (let i = 0; i < 4; i++) a.npcs.civilian(['jogger', 'cashier', 'delivery-driver', 'suburban-mom'][i] ?? 'jogger', square[i], { waypoints: [...square.slice(i), ...square.slice(0, i)] });
  const ids = [a.npcs.civilian('bbq-dad', { x: -2, z: 0 }, { waypoints: [{ x: -2, z: 0 }, { x: 2, z: 0 }] })];
  await a.step(60);
  const spawned = a.query({ kind: 'civilian' }).slice(-5).concat(ids.map(id => a.getEntity(id)!));
  console.log(JSON.stringify(spawned.map(e => [e.id, e.civilian?.state, +e.transform.x.toFixed(1), +e.transform.z.toFixed(1)])));
  return [0, 0];
}), 600, 15, async tick => {
  // Then an infected walks in: everyone flees.
  if (tick === 360) await page.evaluate(() => { window.__SS__!.spawn('infected.runner', { x: -7, z: 1 }, { state: 'chase' }); });
});
// L1 outbreak: the real level, pedestrians fleeing and turned pedestrians chasing.
await scene('l1-outbreak', async () => page.evaluate(async () => {
  const a = window.__SS__!; await a.ready; await a.loadLevel('L1', { seed: 1, checkpoint: 'accident' });
  a.pause(); a.cheats.god(true); a.teleport('player', { x: 58, z: -12 });
  for (const [i, c] of a.query({ kind: 'civilian' }).filter(e => !e.hidden && e.health.current > 0).slice(0, 12).entries()) a.teleport(c.id, { x: 50 + i % 4 * 1.2, z: -9 + Math.floor(i / 4) * 1.2 });
  await a.step(30); return [52, -7];
}), 600, 14);
// Zombies: shamblers and runners close in, attack (lunge-grab), flinch under fast clicks, die, get knocked down by a kick.
await scene('zombies', async () => page.evaluate(async () => {
  const a = window.__SS__!; await a.ready; await a.loadScenario('horde-arena'); a.pause(); a.cheats.god(true);
  a.teleport('player', { x: 0, z: 0 });
  for (const [x, z] of [[-6, 3], [-5, -4], [6, 5]]) a.spawn('infected.runner', { x, z }, { state: 'wander' });
  for (const [x, z] of [[-11, 1], [9, -7]]) a.spawn('infected.runner', { x, z }, { state: 'chase' });
  await a.step(10); return [0, 0];
}), 600, 12, async tick => {
  if (tick > 240 && tick % 6 === 0) {
    const p = await page.evaluate(() => { const a = window.__SS__!, me = a.getState().player!.transform, near = a.query({ kind: 'infected' }).filter(e => e.health.current > 0).sort((u, v) => Math.hypot(u.transform.x - me.x, u.transform.z - me.z) - Math.hypot(v.transform.x - me.x, v.transform.z - me.z))[0]; return near && Math.hypot(near.transform.x - me.x, near.transform.z - me.z) < 2.2 ? a.input.project(near.transform) : null; });
    if (p) { await page.keyboard.down('Shift'); await page.mouse.click(p.x, p.y); await page.keyboard.up('Shift'); }
  }
});
writeFileSync(`${out}/${tag}-probe.json`, JSON.stringify(results, null, 2));
await browser.close(); server?.kill();
