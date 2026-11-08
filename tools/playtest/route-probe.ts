import { createServer } from 'node:http';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { launchBrowser } from '../browser-pool/client';
import { look } from './eyes';
import { preset } from '../../src/sim/progression/Campaign';

/**
 * Route-readability probe (lane r2-way): one headless session played by real WASD input in step mode, with a native
 * prefix to the stretch under test (L1: depot pickup done; L3: actual fallback). Each /act holds keys, then saves a
 * frame and returns the HUD objective, the edge-arrow direction and, for the analyst only, the courier position.
 *
 *   npm run build:qa && E2E_PORT=4771 PROBE_PORT=4772 npx tsx tools/playtest/route-probe.ts --level L1 --quality low --out test-results/r2-way/l1-a
 *   curl -s -XPOST localhost:4772/act -d '{"move":"sd","ms":3000,"shot":"a"}'
 *   curl -s -XPOST localhost:4772/act -d '{"zoom":1.5,"shot":"z15"}'
 *   curl -s -XPOST localhost:4772/act -d '{"teleport":[40,-35],"shot":"t"}'   (viewpoint captures only, never during a trial)
 */
const arg = (name: string, fallback: string) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const level = arg('level', 'L1'), quality = arg('quality', 'low'), out = resolve(arg('out', `test-results/r2-way/${level}`)), renderer = arg('renderer', 'webgl');
const port = Number(process.env.E2E_PORT ?? 4771), probePort = Number(process.env.PROBE_PORT ?? 4772);
if (port === 3300 || probePort === 3300) throw new Error('never port 3300');
if (!existsSync('dist/index.html')) throw new Error('npm run build:qa first');
mkdirSync(out, { recursive: true });
const origin = `http://127.0.0.1:${port}`;
const up = async () => { try { return (await fetch(origin)).ok; } catch { return false; } };
let server: ChildProcess | null = null;
if (!(await up())) {
  server = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort', '--configLoader', 'runner'], { stdio: 'ignore' });
  for (let i = 0; i < 120 && !(await up()); i++) await new Promise(r => setTimeout(r, 500));
}
const hold = (ms: number) => new Promise(r => setTimeout(r, ms));
const args = process.platform === 'darwin' ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const browser = await launchBrowser({ headless: true, args });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
await page.addInitScript('window.__name = (f) => f;');
const menuUrl = `${origin}/?test=poses&testApi=1&scenelab=1&renderer=${renderer}&dpr=1&audio=muted&quality=${quality}`;
await page.goto(menuUrl);
await page.waitForFunction(() => !!window.__SS__, null, { timeout: 120_000 });
await page.evaluate(() => window.__SS__!.ready);
if (level !== 'L1') {
  await page.evaluate(({ save }) => { const api = window.__SS__!; api.campaign.restore(save); api.campaign.save(); }, { save: preset(`L${level.slice(1)}-default` as `L${2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10}-default`) });
  await page.reload();
  await page.waitForFunction(() => !!window.__SS__, null, { timeout: 120_000 });
  await page.evaluate(() => window.__SS__!.ready);
}
await page.getByTestId('start-game').click({ timeout: 120_000 });
await hold(500);
if (await page.getByTestId('character-female').isVisible().catch(() => false)) await page.getByTestId('character-female').click();
await page.getByTestId(`level-${level}`).click({ timeout: 60_000 });
await Promise.race([
  page.getByTestId('mission-button').waitFor({ state: 'visible', timeout: 120_000 }),
  page.waitForFunction(() => window.__SS__!.missions.state()?.phase === 'playing', null, { timeout: 120_000 }),
]);
if (await page.evaluate(() => window.__SS__!.missions.state()?.phase) === 'briefing') {
  const button = page.getByTestId('mission-button'); await button.click(); await hold(900);
  if (await page.evaluate(() => window.__SS__!.missions.state()?.phase) === 'briefing') await button.click();
}
const prefix = arg('prefix', level === 'L1' ? 'pickup' : level === 'L3' ? 'fallback' : 'none');
const prefixInfo = await page.evaluate(async (prefix) => {
  const a = window.__SS__!;
  a.pause();
  if (prefix === 'none') return { tick: a.getState().tick };
  a.bot.start('complete', prefix === 'fallback' ? { street: 'auto' } : undefined);
  try {
    for (let i = 0; i < 3000; i++) {
      const m = a.missions.state() as unknown as { l3?: { fallbackAt?: number }; steps?: Record<string, { status?: string }> };
      if (prefix === 'fallback' && m.l3?.fallbackAt) break;
      if (prefix === 'pickup' && m.steps?.deliver?.status === 'active') break;
      await a.step(5);
    }
  } finally { a.bot.stop(); a.input.clear(); }
  a.camera.follow(); a.camera.zoom(1);
  return { tick: a.getState().tick, steps: Object.fromEntries(Object.entries((a.missions.state() as unknown as { steps: Record<string, { status: string }> }).steps ?? {}).map(([k, v]) => [k, v.status])) };
}, prefix);
console.log('prefix', JSON.stringify(prefixInfo));
await page.evaluate(enabled => window.__SS__!.cheats.god(enabled), arg('god', '1') !== '0');
const clock = (run: boolean) => page.evaluate(r => { const c = (window.__SCENE__ as unknown as { game: { clock: { pause(): void; resume(): void } } } | undefined)?.game.clock; if (c) { if (r) c.resume(); else c.pause(); } }, run);
await clock(false);
let n = 0;
type Act = { move?: string; ms?: number; wait?: number; zoom?: number; teleport?: [number, number]; shot?: string; key?: string; attack?: boolean; appearance?: { variant: 'female' | 'male'; gear: 0 | 1 | 2 | 3 | 4 } };
const state = async () => {
  const e = await page.evaluate(look);
  const p = e.player;
  let dir = '';
  if (e.marker) { const dx = e.marker.x - e.view.w / 2, dy = e.marker.y - e.view.h / 2; dir = ['right', 'down-right', 'down', 'down-left', 'left', 'up-left', 'up', 'up-right'][((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8]; }
  return { appearance: await page.evaluate(() => { const s = (window.__SCENE__ as unknown as { game: { world: { entities: { get(id: number): { survivor: { variant: string; gearTier: number } } } } } }).game.world.entities.get(1).survivor; return { variant: s.variant, gearTier: s.gearTier }; }), tick: e.tick, step: e.step, objective: e.objective, tracker: e.tracker, distance: e.distance, marker: e.marker ? { offscreen: e.marker.offscreen, dir, x: Math.round(e.marker.x), y: Math.round(e.marker.y) } : null, pos: p ? [+p.x.toFixed(1), +p.z.toFixed(1)] : null };
};
createServer((req, res) => {
  let data = '';
  req.on('data', c => { data += c; });
  req.on('end', async () => {
    try {
      const a = JSON.parse(data || '{}') as Act;
      // Appearance fixtures are visual spots, never evidence of a reachable campaign loadout.
      if (a.appearance) {
        const { variant, gear } = a.appearance;
        if (!['female', 'male'].includes(variant) || ![0, 1, 2, 3, 4].includes(gear)) throw new Error('Invalid appearance');
        await page.evaluate(async ({ variant, gear }) => { await window.__SS__!.survivor.select(variant, gear); }, { variant, gear });
      }
      if (a.teleport) await page.evaluate(([x, z]) => { const s = window.__SS__!; s.teleport('player', { x, z }); s.camera.follow(); }, a.teleport);
      if (a.zoom) await page.evaluate(z => window.__SS__!.camera.zoom(z), a.zoom);
      if (a.key) { await clock(true); await page.keyboard.press(a.key); await hold(300); await clock(false); }
      if (a.move) {
        const keys = [...new Set([...a.move.toLowerCase()].filter(k => 'wasd'.includes(k)))].map(k => `Key${k.toUpperCase()}`);
        await clock(true);
        try { if (a.attack) await page.keyboard.down('Space'); for (const k of keys) await page.keyboard.down(k); await hold(Math.min(6000, a.ms ?? 1000)); }
        finally { if (a.attack) await page.keyboard.up('Space').catch(() => undefined); for (const k of keys.reverse()) await page.keyboard.up(k).catch(() => undefined); await clock(false); }
      }
      if (a.wait) { await clock(true); await hold(a.wait); await clock(false); }
      if (a.teleport || a.zoom) { await clock(true); await hold(400); await clock(false); }
      const s = await state();
      let file = '';
      if (a.shot !== undefined) { file = resolve(out, `${String(++n).padStart(3, '0')}-${a.shot || 'f'}.jpg`); await page.screenshot({ path: file, type: 'jpeg', quality: 72 }); }
      res.end(JSON.stringify({ ...s, file }) + '\n');
    } catch (error) { res.statusCode = 500; res.end(String(error) + '\n'); }
  });
}).listen(probePort, '127.0.0.1', () => console.log(`probe on http://127.0.0.1:${probePort}`));
const stop = async () => { await browser.close().catch(() => undefined); server?.kill(); process.exit(0); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
