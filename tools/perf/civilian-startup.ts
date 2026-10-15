/** Paired cold UI diagnostics; run with quiet-run.sh -> e2e-lock.sh.
 * E2E_PORT=35974 STARTUP_BASELINE=/tmp/baseline/dist npx tsx tools/perf/civilian-startup.ts [L1 ... L10]
 * One browser, fresh HTTP context per case; browser/driver caches remain shared. Not percentiles. */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { preset, type Level, type ProgressionPreset } from '../../src/sim/progression/Campaign';
import { SaveStore } from '../../src/sim/progression/Save';

const port = Number(process.env.E2E_PORT ?? 35974);
if (port === 3300 || port + 1 === 3300) throw new Error('Use private preview ports');
const builds = [
  { label: 'candidate', port, directory: resolve('dist') },
  ...(process.env.STARTUP_BASELINE ? [{ label: 'baseline', port: port + 1, directory: resolve(process.env.STARTUP_BASELINE) }] : []),
];
const out = process.env.STARTUP_OUT ?? 'test-results/load-civ-bakes'; mkdirSync(out, { recursive: true });
const servers = builds.map(build => spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(build.port), '--strictPort', '--outDir', build.directory, '--configLoader', 'runner'], { stdio: 'ignore' }));
const rows: object[] = [], levels = process.argv.slice(2).length ? process.argv.slice(2) : Array.from({ length: 10 }, (_, i) => `L${i + 1}`);
const save = () => writeFileSync(`${out}/cold-menu.json`, JSON.stringify({ method: 'fresh HTTP contexts; alternating paired order; headless Metal; 1600x900 DPR1; page CDP 50Mbps/20ms (worker throttling unverified); two RAFs after Begin/gameplay; title preloading active; single diagnostic samples, shared driver caches', builds, rows }, null, 2));
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  for (const build of builds) {
    let up = false;
    for (let i = 0; i < 120; i++) {
      try { up = (await fetch(`http://127.0.0.1:${build.port}`)).ok; } catch { /* starting */ }
      if (up) break;
      await new Promise(r => setTimeout(r, 250));
    }
    if (!up) throw new Error(`Private preview did not start: ${build.port}`);
  }
  browser = await chromium.launch({ headless: true, args: process.platform === 'darwin' ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const [index, level] of levels.entries()) for (const build of index % 2 ? builds : [...builds].reverse()) {
    const origin = `http://127.0.0.1:${build.port}`;
    const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
    // Seed the real save before boot so title prefetch targets this level, not L1.
    if (level !== 'L1') {
      const n = Number(level.slice(1)) as Level;
      const campaign = preset(`L${n === 7 ? 6 : n === 9 ? 8 : n}-default` as ProgressionPreset);
      campaign.completedLevels = n - 1; campaign.unlockedLevel = n; campaign.settings.quality = 'high';
      const stored = new Map<string, string>();
      new SaveStore({ getItem: key => stored.get(key) ?? null, setItem: (key, value) => { stored.set(key, value); }, removeItem: key => { stored.delete(key); } }).write(campaign);
      await context.addInitScript(entries => { if (location.protocol === 'http:') for (const [key, value] of entries) localStorage.setItem(key, value); }, [...stored]);
    }
    const page = await context.newPage(), requests: Promise<{ url: string; bodyBytes: number }>[] = [], errors: string[] = [];
    let collecting = true;
    context.on('requestfinished', request => { if (collecting && request.url().startsWith(origin)) requests.push(request.sizes().then(s => ({ url: new URL(request.url()).pathname, bodyBytes: s.responseBodySize }))); });
    page.on('pageerror', error => errors.push(String(error)));
    const cdp = await context.newCDPSession(page); await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 20, downloadThroughput: 50_000_000 / 8, uploadThroughput: 50_000_000 / 8 });
    try {
      await page.goto(`${origin}/?testApi=1&renderer=webgl&quality=high&audio=muted`);
      await page.getByTestId('start-game').waitFor({ timeout: 120_000 });
      await page.waitForFunction(() => !!window.__SS__);
      const titleMs = await page.evaluate(() => performance.now());
      await page.getByTestId('start-game').click();
      if (level === 'L1') await page.getByTestId('character-female').click();
      const start = await page.evaluate(() => performance.now());
      await page.getByTestId(`level-${level}`).click();
      const control = await Promise.race([
        page.getByTestId('mission-button').waitFor({ timeout: 180_000 }).then(() => 'briefing'),
        page.getByTestId('pause-button').waitFor({ timeout: 180_000 }).then(() => 'playing'),
      ]);
      if (control === 'briefing') {
        await page.evaluate(() => window.__SS__!.screenshotReady()); collecting = false;
        await page.getByTestId('mission-button').click();
      } else collecting = false;
      const end = await page.evaluate(async () => { await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame); return performance.now(); });
      const files = await Promise.all(requests), bodyBytes = files.reduce((n, f) => n + f.bodyBytes, 0);
      await page.evaluate(() => window.__SS__!.pause());
      await page.screenshot({ path: `${out}/${build.label}-${level}-game-camera.png` });
      rows.push({ build: build.label, level, titleMs, menuToPlayableMs: end - start, bodyBytes, errors, files }); save();
      console.log(`${build.label} ${level}: ${(end - start).toFixed(0)} ms; ${(bodyBytes / 1e6).toFixed(2)} MB before Begin/gameplay`);
    } catch (error) { rows.push({ build: build.label, level, error: String(error), errors }); save(); throw error; }
    finally { await context.close(); }
  }
} finally { await browser?.close(); for (const server of servers) server.kill(); save(); }
