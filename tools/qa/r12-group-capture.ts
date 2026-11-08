/** r12-group: real-input group captures (moving and standing) at zoom 1 and 1.5.
 *   npm run build:qa && E2E_PORT=4771 node --import tsx/esm tools/qa/r12-group-capture.ts --level L7 --quality low --out test-results/r12-group/after
 * The game's own complete bot drives the courier with ordinary InputFrames (no teleports, no objective skips);
 * the script only pauses at moments with the group in frame and saves JPEGs. Standing = courier still ≥ 2 s. */
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { launchBrowser } from '../browser-pool/client';
import { preset } from '../../src/sim/progression/Campaign';

const arg = (name: string, fallback: string) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const level = arg('level', 'L7'), quality = arg('quality', 'low'), out = arg('out', 'test-results/r12-group/capture');
const port = Number(process.env.E2E_PORT ?? 4771);
if (port === 3300) throw new Error('never port 3300');
if (!existsSync('dist/index.html')) throw new Error('npm run build:qa first');
mkdirSync(out, { recursive: true });
const origin = `http://127.0.0.1:${port}`;
const up = async () => { try { return (await fetch(origin)).ok; } catch { return false; } };
let server: ChildProcess | null = null;
if (!(await up())) {
  server = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort', '--configLoader', 'runner'], { stdio: 'ignore' });
  for (let i = 0; i < 120 && !(await up()); i++) await new Promise(r => setTimeout(r, 500));
}
const args = process.platform === 'darwin' ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const browser = await launchBrowser({ headless: true, args });
const log: unknown[] = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await page.addInitScript('window.__name = (f) => f;');
  const menuUrl = `${origin}/?testApi=1&renderer=webgl&dpr=1&audio=muted&quality=${quality}`;
  await page.goto(menuUrl);
  await page.waitForFunction(() => !!window.__SS__, null, { timeout: 120_000 });
  await page.evaluate(() => window.__SS__!.ready);
  await page.evaluate(({ save }) => { const api = window.__SS__!; api.campaign.restore(save); api.campaign.save(); }, { save: preset(`${level}-default` as never) });
  await page.reload();
  await page.waitForFunction(() => !!window.__SS__, null, { timeout: 120_000 });
  await page.evaluate(() => window.__SS__!.ready);
  await page.getByTestId('start-game').click({ timeout: 120_000 });
  await page.waitForTimeout(500);
  if (await page.getByTestId('character-female').isVisible().catch(() => false)) await page.getByTestId('character-female').click();
  await page.getByTestId(`level-${level}`).click({ timeout: 60_000 });
  await Promise.race([
    page.getByTestId('mission-button').waitFor({ state: 'visible', timeout: 120_000 }),
    page.waitForFunction(() => window.__SS__!.missions.state()?.phase === 'playing', null, { timeout: 120_000 }),
  ]);
  for (let i = 0; i < 3 && await page.evaluate(() => window.__SS__!.missions.state()?.phase) === 'briefing'; i++) {
    await page.getByTestId('mission-button').click().catch(() => undefined); await page.waitForTimeout(900);
  }
  await page.evaluate(() => window.__SS__!.pause());
  /** Followers within 12 m, the courier's speed, and how long she has been still. */
  const probe = () => page.evaluate(() => {
    const a = window.__SS__!, p = a.getEntity(1)!, v = p.survivor?.velocity ?? { x: 0, z: 0 };
    const near = a.query({ within: { x: p.transform.x, z: p.transform.z, r: 12 } }).filter(e => e.civilian?.survivor?.mode === 'follow' && !e.hidden && e.health.current > 0 && e.passengerOf === undefined);
    return { tick: a.tick(), speed: Math.hypot(v.x, v.z), near: near.length, moving: near.filter(e => (e.motion?.speed ?? 0) > 1).length };
  });
  const shot = async (name: string) => {
    for (const zoom of [1, 1.5]) {
      await page.evaluate(async z => { const a = window.__SS__!; a.camera.follow(); a.camera.zoom(z); await a.step(1); }, zoom);
      await page.waitForTimeout(250);
      const path = `${out}/${level}-${quality}-${name}-z${zoom}.jpg`;
      await page.screenshot({ path, type: 'jpeg', quality: 80 });
      log.push({ path, ...(await probe()) });
    }
    await page.evaluate(() => window.__SS__!.camera.zoom(1));
  };
  const step = (n: number) => page.evaluate(async k => window.__SS__!.step(k), n);
  // Standing before the courier moves (L7/L8 start with the group behind her; the PO's screenshot).
  await step(150);
  if ((await probe()).near >= 3) await shot('stand-start');
  await page.evaluate(() => window.__SS__!.bot.start('complete'));
  let still = 0, moving = 0, haveMove = 0, haveStand = 0;
  const minNear = level === 'L5' ? 3 : 6;
  for (let i = 0; i < 4000 && (haveMove < 2 || haveStand < 1); i++) {
    await step(6);
    const s = await probe();
    if (s.speed < .2) { still += 6; moving = 0; } else { moving += 6; still = 0; }
    if (haveMove < 2 && moving >= 240 + haveMove * 600 && s.near >= minNear && s.moving >= minNear - 1) { await shot(`move${haveMove + 1}`); haveMove++; moving = 0; }
    if (haveStand < 1 && still >= 120 && s.near >= minNear && (await probe()).tick > 600) { await shot('stand'); haveStand++; }
  }
  await page.evaluate(() => window.__SS__!.bot.stop());
} finally {
  writeFileSync(`${out}/${level}-${quality}-log.json`, JSON.stringify(log, null, 1));
  await browser.close().catch(() => undefined);
  server?.kill();
}
process.exit(0);
