/** Diagnostic cold UI loads, matching the loading audit's page throttle and worker-inclusive bytes.
 * E2E_PORT=35974 sh tools/perf/quiet-run.sh sh tools/e2e-lock.sh npx tsx tools/perf/civilian-startup.ts [L1 ... L10]
 * One browser, fresh HTTP context per level; browser/driver caches remain shared. Not percentiles. */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { preset } from '../../src/sim/progression/Campaign';

const port = Number(process.env.E2E_PORT ?? 35974);
if (port === 3300) throw new Error('Use a private preview port');
const origin = `http://127.0.0.1:${port}`, out = 'test-results/load-civ-bakes';
mkdirSync(out, { recursive: true });
const server = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort', '--configLoader', 'runner'], { stdio: 'ignore' });
const rows: object[] = [];
const levels = process.argv.slice(2).length ? process.argv.slice(2) : Array.from({ length: 10 }, (_, i) => `L${i + 1}`);
const save = () => writeFileSync(`${out}/cold-menu.json`, JSON.stringify({ method: 'fresh HTTP contexts; headless Metal; 1600x900 DPR1; page CDP 50Mbps/20ms (worker throttling unverified); two RAFs after Begin/gameplay; diagnostic single samples', rows }, null, 2));
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  let up = false;
  for (let i = 0; i < 120; i++) {
    try { up = (await fetch(origin)).ok; } catch { /* starting */ }
    if (up) break;
    await new Promise(r => setTimeout(r, 250));
  }
  if (!up) throw new Error('Private preview did not start');
  browser = await chromium.launch({ headless: true, args: process.platform === 'darwin' ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const level of levels) {
    const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
    const page = await context.newPage(), requests: Promise<{ url: string; bodyBytes: number }>[] = [], errors: string[] = [];
    let collecting = true;
    context.on('requestfinished', request => { if (collecting && request.url().startsWith(origin)) requests.push(request.sizes().then(s => ({ url: new URL(request.url()).pathname, bodyBytes: s.responseBodySize }))); });
    page.on('pageerror', error => errors.push(String(error)));
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 20, downloadThroughput: 50_000_000 / 8, uploadThroughput: 50_000_000 / 8 });
    try {
      await page.goto(`${origin}/?testApi=1&renderer=webgl&quality=high&audio=muted`);
      await page.getByTestId('start-game').waitFor({ timeout: 120_000 });
      await page.waitForFunction(() => !!window.__SS__);
      await page.evaluate(save => { window.__SS__!.campaign.restore(save); window.__SS__!.campaign.save(); window.__SS__!.campaign.menu(); }, preset('L10-default'));
      await page.getByTestId('start-game').click();
      const start = await page.evaluate(() => performance.now());
      await page.getByTestId(`level-${level}`).click();
      if (Number(level.slice(1)) <= 6) {
        await page.getByTestId('mission-button').waitFor({ timeout: 180_000 });
        await page.evaluate(() => window.__SS__!.screenshotReady());
        collecting = false;
        await page.getByTestId('mission-button').click();
      } else {
        await page.getByTestId('pause-button').waitFor({ timeout: 180_000 });
        collecting = false;
      }
      const end = await page.evaluate(async () => { await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame); return performance.now(); });
      const files = await Promise.all(requests), bodyBytes = files.reduce((n, f) => n + f.bodyBytes, 0);
      await page.evaluate(() => window.__SS__!.pause());
      await page.screenshot({ path: `${out}/${level}-game-camera.png` });
      rows.push({ level, menuToPlayableMs: end - start, bodyBytes, errors, files }); save();
      console.log(`${level}: ${(end - start).toFixed(0)} ms; ${(bodyBytes / 1e6).toFixed(2)} MB before Begin/gameplay`);
    } catch (error) { rows.push({ level, error: String(error), errors }); save(); throw error; }
    finally { await context.close(); }
  }
} finally { await browser?.close(); server.kill(); save(); }
