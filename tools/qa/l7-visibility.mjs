/** Live browser observation of queued L7 admissions. Run under tools/e2e-lock.sh with a free E2E_PORT. */
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { writeFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { launchBrowser } from '../browser-pool/client.ts';
import { provenance } from './accept/probe.ts';
import { browserHash } from './accept/browser.ts';
const tier = process.argv[2], zoom = Number(process.argv[3] ?? 1);
if (![.5, 1, 1.5].includes(zoom)) throw new Error('Supply zoom .5, 1 or 1.5');
if (!['low', 'high'].includes(tier)) throw new Error('Supply low or high');
const port = Number(process.env.E2E_PORT ?? 5125);
if (port === 3300) throw new Error('Port 3300 is reserved');
const server = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort', '--configLoader', 'runner'], { stdio: 'ignore' });
let browser;
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(`http://127.0.0.1:${port}`)).ok) break; } catch {} await delay(100); }
  browser = await launchBrowser({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.addInitScript('window.__name=f=>f');
  await page.goto(`http://127.0.0.1:${port}/?test=1&ui=1&scenelab=1&renderer=webgl&quality=${tier}&controls=wasd&audio=muted&dpr=1&preload=0`);
  await page.waitForFunction(() => !!window.__SS__ && !!window.__SCENE__);
  const setup = await page.evaluate(async ({ tier, zoom }) => {
    const a = window.__SS__, g = window.__SCENE__.game; await a.ready; a.pause(); await a.loadLevel('L7', { seed: 1 }); a.pause();
    a.settings.set({ quality: tier, cameraShake: false, cheapDof: false });
    const w = g.world, ai = w.infected, original = ai.spawn.bind(ai); window.__l7Visibility = [];
    ai.spawn = (id, pos, options = {}, conversion = false) => {
      if (options.pack >= 700 && options.pack <= 714 && !conversion) {
        const d = ai.director;
        window.__l7Visibility.push({ tick: w.tick, id, pack: options.pack, pos: { ...pos }, offscreen: d.offscreen(pos, pos.y ? pos.y - .7 : 0), occluded: d.occluded(pos), frustum: d.hasFrustum, actualZoom: a.getState().render.camera.zoom });
      }
      return original(id, pos, options, conversion);
    };
    a.missions.begin(); a.camera.zoom(zoom); a.bot.start('complete'); a.resume(); return { backend: a.perf().backend };
  }, { tier, zoom });
  for (let i = 0; i < 180; i++) {
    await delay(1000);
    const status = await page.evaluate(() => { const w = window.__SCENE__.game.world; return { tick: w.tick, phase: w.missions.state.phase, count: window.__l7Visibility.length }; });
    if (i % 30 === 0) console.log(status);
    if (status.phase === 'result') break;
  }
  const data = await page.evaluate(() => ({ events: window.__l7Visibility, tick: window.__SCENE__.game.world.tick, phase: window.__SCENE__.game.world.missions.state.phase }));
  const summary = { ...provenance(), browserHash: browserHash(), tier, seed: 1, zoom, setup, ...data };
  writeFileSync(`docs/reports/s192-l7harder/visibility-${tier}-z${zoom}.json`, JSON.stringify(summary, null, 2) + '\n');
  const expected = tier === 'low' ? 256 : 536;
  const noFrustum = data.events.filter(x => !x.frustum).length, visible = data.events.filter(x => !x.offscreen).length;
  const zoomMismatch = data.events.filter(x => Math.abs(x.actualZoom - zoom) > .02).length;
  console.log(JSON.stringify({ tier, phase: data.phase, count: data.events.length, expected, noFrustum, visible, zoomMismatch }));
  if (data.phase !== 'result' || data.events.length !== expected || noFrustum || visible || zoomMismatch) process.exitCode = 1;
  await context.close();
} finally { await browser?.close(); server.kill(); }
