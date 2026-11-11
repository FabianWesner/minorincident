// r33-vqa: real-key driving probe. Loads a fixture (or level:L9) and drives by key presses only.
// Per segment it logs the vehicle yaw and the nose direction ON SCREEN (projected), so "A turns the nose to the driver's left"
// can be checked at every heading the circle passes through. Screenshots every 0.75 s.
//   E2E_PORT=4926 E2E_UNITS=1 sh tools/e2e-lock.sh npx tsx tools/qa/r33/drivekeys.ts <origin> <fixture|level:L9> --out <dir> [--quality low] [--zoom 1.5] [--backend webgpu]
import { mkdirSync, appendFileSync, mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { launchProfile } from '../../browser-pool/client';
import { readFixture } from '../fixture-io';
import { loadFixtureInPage } from '../load-fixture';

const { values, positionals } = parseArgs({ allowPositionals: true, options: {
  out: { type: 'string' }, quality: { type: 'string', default: 'low' }, zoom: { type: 'string', default: '1.5' }, backend: { type: 'string', default: 'webgpu' },
} });
const [origin, name] = positionals;
const direct = name?.startsWith('level:') ? name.split(':') : null;
const path = direct ? 'direct' : ['', '.json.gz', '.json.br'].map(ext => resolve(existsSync(name) ? name : `tests/fixtures/saves/qa/${name}${ext}`)).find(existsSync);
if (!origin || !path) throw new Error('usage');
const out = resolve(values.out!); mkdirSync(out, { recursive: true });
const log = (o: object) => appendFileSync(`${out}/log.jsonl`, JSON.stringify(o) + '\n');
const fixture = direct ? null : readFixture(path);
const context = await launchProfile(mkdtempSync(`${tmpdir()}/r33drive-`), { headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu'], viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
await page.addInitScript({ content: 'window.__name = (f) => f;' });
try {
  await page.goto(`${origin}/?test=poses&testApi=1&scenelab=1&${values.backend === 'webgpu' ? '' : 'renderer=webgl&'}dpr=1&audio=muted&quality=${values.quality}`);
  await page.waitForFunction(() => !!window.__SS__, null, { timeout: 180000 });
  await page.evaluate(async q => { await window.__SS__!.ready; window.__SS__!.settings.set({ quality: q as 'low' }); }, values.quality!);
  if (fixture) await loadFixtureInPage(page, fixture);
  else await page.evaluate(async lvl => { const a = window.__SS__!; await a.loadLevel(lvl, { seed: 1 }); a.pause(); await a.step(60); }, direct![1]);
  await page.evaluate(async z => { const a = window.__SS__!; a.cheats.god(true); a.camera.follow(); a.camera.zoom(z); a.resume(); }, Number(values.zoom));
  await page.mouse.click(640, 360);
  const sample = () => page.evaluate(() => {
    const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: { world: { vehicles: { active: number | null; cars: Map<number, { entity: { transform: { x: number; z: number; yaw: number }; vehicle: { speed?: number } }; body?: unknown }> } } } }).game;
    const id = g.world.vehicles.active; const car = id == null ? undefined : g.world.vehicles.cars.get(id);
    if (!car) return null;
    const t = car.entity.transform, f = { x: Math.cos(t.yaw), z: -Math.sin(t.yaw) };
    const p0 = a.input.project({ x: t.x, z: t.z }, 'player'), p1 = a.input.project({ x: t.x + f.x * 4, z: t.z + f.z * 4 }, 'player');
    return { tick: a.tick(), x: t.x, z: t.z, yaw: t.yaw, nose: { x: p1.x - p0.x, y: p1.y - p0.y }, speed: (car.entity.vehicle as { speed?: number }).speed ?? null };
  });
  let shot = 0;
  const seg = async (label: string, keys: string[], ms: number) => {
    for (const k of keys) await page.keyboard.down(k);
    const t0 = Date.now(); let prev = await sample(); let lastShot = 0;
    while (Date.now() - t0 < ms) {
      await page.waitForTimeout(150);
      const s = await sample(); if (!s || !prev) { prev = s; continue; }
      // screen-space turn: cross of nose vectors (screen y down). Negative cross = nose turned counter-clockwise on screen = driver's left
      const cross = prev.nose.x * s.nose.y - prev.nose.y * s.nose.x;
      const moved = Math.hypot(s.x - prev.x, s.z - prev.z);
      const fwd = (s.x - prev.x) * Math.cos(s.yaw) + (s.z - prev.z) * -Math.sin(s.yaw);
      const heading = Math.abs(s.nose.x) > Math.abs(s.nose.y) ? (s.nose.x > 0 ? 'screen-right' : 'screen-left') : (s.nose.y > 0 ? 'screen-down' : 'screen-up');
      log({ label, keys, tick: s.tick, heading, yaw: +s.yaw.toFixed(3), dyaw: +(Math.atan2(Math.sin(s.yaw - prev.yaw), Math.cos(s.yaw - prev.yaw))).toFixed(3), screenTurn: cross < -1 ? 'ccw(left)' : cross > 1 ? 'cw(right)' : 'none', moved: +moved.toFixed(2), fwd: +fwd.toFixed(2), speed: s.speed });
      if (Date.now() - lastShot > 750) { lastShot = Date.now(); await page.screenshot({ path: `${out}/d${String(shot++).padStart(3, '0')}-${label}-t${s.tick}.jpg`, type: 'jpeg', quality: 70 }); }
      prev = s;
    }
    for (const k of keys) await page.keyboard.up(k);
  };
  log({ start: await sample() });
  await seg('W', ['KeyW'], 2500);
  await seg('W+A', ['KeyW', 'KeyA'], 9000);
  await seg('W', ['KeyW'], 1500);
  await seg('W+D', ['KeyW', 'KeyD'], 9000);
  await seg('S-brake-reverse', ['KeyS'], 4000);
  await seg('S+A', ['KeyS', 'KeyA'], 3000);
  await seg('idle', [], 1000);
  await seg('Up+Left', ['ArrowUp', 'ArrowLeft'], 4000);
  await seg('Up+Right', ['ArrowUp', 'ArrowRight'], 4000);
  log({ end: await sample() });
} finally { await context.close(); }
