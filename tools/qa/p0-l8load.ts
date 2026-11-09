/** L8 cold loading and Begin+60s proof. Run through tools/e2e-lock.sh (one pooled browser, 600s cap). */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import type { Page } from '@playwright/test';
import { launchBrowser } from '../browser-pool/client';
import { attachErrorGuard } from '../../tests/e2e/fixtures';
import { preset } from '../../src/sim/progression/Campaign';

const out = resolve(process.argv[2] ?? 'docs/reports/p0-l8load');
mkdirSync(out, { recursive: true });
const assets = ['amb.monkey', 'inf.monkey', 'amb.lioness', 'inf.lioness'];
const assetHashes = Object.fromEntries(assets.flatMap(id => [0, 1, 2].flatMap(lod => ['', '.low'].map(quality => {
  const path = `public/assets/models/skinned/${id}.lod${lod}${quality}.glb`;
  return [path, createHash('sha256').update(readFileSync(path)).digest('hex')];
}))));
const socket = createServer();
await new Promise<void>((ready, reject) => { socket.once('error', reject); socket.listen(0, '127.0.0.1', ready); });
const address = socket.address(); assert(address && typeof address !== 'string' && address.port !== 3300);
const origin = `http://127.0.0.1:${address.port}`;
await new Promise<void>(ready => socket.close(() => ready()));
const server = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(address.port), '--strictPort', '--configLoader', 'runner'], { stdio: 'ignore' });
const identity = {
  revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  generatedAt: new Date().toISOString(), assetHashes,
  method: 'One shared headless Metal browser; fresh isolated context for each quality/backend cell. L8-default campaign with requested quality before loading, native Begin click, production complete bot, normal mortal simulation for at least 3600 ticks and 60 wall seconds. No actor, health, mission, time-scale or renderer overrides.',
};
async function snapshot(page: Page) {
  return page.evaluate(() => {
    const api = window.__SS__!, state = api.getState(), perf = api.perf(), mission = api.missions.state();
    return { tick: api.tick(), backend: perf.backend, quality: state.render.quality, paused: perf.paused,
      renderedFrames: perf.renderedFrames, contextLost: perf.contextLost,
      player: api.getEntity(1), bot: api.bot.status(), mission };
  });
}
type Snapshot = Awaited<ReturnType<typeof snapshot>>;
const cells: { cell: string; pass: boolean; error?: string; loaded?: Snapshot; begin?: Snapshot; final?: Snapshot; wallSeconds?: number; errors: string[]; warnings: string[]; requests: { path: string; status: number }[] }[] = [];
let browser: Awaited<ReturnType<typeof launchBrowser>> | undefined;
try {
  let ready = false;
  for (let i = 0; i < 200; i++) {
    try { if ((await fetch(origin)).ok) { ready = true; break; } } catch { /* owned server is starting */ }
    await delay(100);
  }
  assert(ready, 'Owned Vite server did not start');
  browser = await launchBrowser({ headless: true, args: ['--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist', process.platform === 'darwin' ? '--use-angle=metal' : '--use-angle=swiftshader'] });
  for (const backend of ['webgl2', 'webgpu'] as const) for (const quality of ['low', 'high'] as const) {
    const cell = `${quality}-${backend}`, context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    const page = await context.newPage(), guard = attachErrorGuard(page);
    const result: typeof cells[number] = { cell, pass: false, errors: guard.errors, warnings: [], requests: [] };
    console.log(`[L8] loading ${cell}`);
    page.on('console', message => { if (/PLACEHOLDER BOX|\[assets\].*fallback/i.test(message.text())) result.warnings.push(message.text()); });
    page.on('response', response => {
      const path = new URL(response.url()).pathname;
      if (/\/assets\/models\/skinned\/(amb|inf)\.(monkey|lioness)\..*\.glb$/.test(path)) result.requests.push({ path, status: response.status() });
    });
    try {
      const params = new URLSearchParams({ test: '1', ui: '1', quality, audio: 'muted', dpr: '1' });
      if (backend === 'webgl2') params.set('renderer', 'webgl');
      await page.goto(`${origin}/?${params}`);
      await page.waitForFunction(() => !!window.__SS__, undefined, { timeout: 120_000 });
      const campaign = preset('L8-default'); campaign.settings.quality = quality;
      await page.evaluate(async campaign => {
        const api = window.__SS__!; await api.ready; api.pause();
        api.settings.set({ quality: campaign.settings.quality }); api.campaign.restore(campaign);
        await api.loadLevel('L8', { seed: 1 });
        api.pause(); await api.screenshotReady(); api.bot.start('complete');
      }, campaign);
      result.loaded = await snapshot(page);
      assert.equal(result.loaded.backend, backend, `${cell}: actual backend`);
      assert.equal(result.loaded.quality, quality, `${cell}: actual quality`);
      await page.screenshot({ path: `${out}/${cell}-loaded.jpg`, type: 'jpeg', quality: 70 });
      await page.getByTestId('mission-button').click({ timeout: 120_000 });
      const started = Date.now(); result.begin = await snapshot(page);
      assert.equal(result.begin.paused, false, `${cell}: Begin resumes simulation`);
      await page.waitForFunction(target => window.__SS__!.tick() >= target, result.begin.tick + 3600, { timeout: 120_000 });
      await delay(Math.max(0, started + 60_000 - Date.now()));
      await page.evaluate(async () => { const api = window.__SS__!; api.pause(); await api.screenshotReady(); });
      result.final = await snapshot(page); result.wallSeconds = (Date.now() - started) / 1000;
      assert(result.final.tick - result.begin.tick >= 3600, `${cell}: 60 simulation seconds`);
      assert(result.final.player && result.final.player.health.current > 0, `${cell}: courier remains alive`);
      assert.equal(result.final.backend, backend); assert.equal(result.final.quality, quality);
      assert.equal(result.final.contextLost, false);
      assert(result.final.renderedFrames - result.begin.renderedFrames > 60, `${cell}: scene keeps rendering`);
      for (const id of assets) assert(result.requests.some(request => request.path.includes(`/${id}.lod`) && request.path.endsWith(quality === 'low' ? '.low.glb' : '.glb') && (quality === 'low' || !request.path.endsWith('.low.glb')) && request.status === 200), `${cell}: fetched ${id} at requested tier`);
      assert.deepEqual(result.errors, [], `${cell}: browser errors`);
      assert.deepEqual(result.warnings, [], `${cell}: asset fallbacks`);
      await page.screenshot({ path: `${out}/${cell}-60s.jpg`, type: 'jpeg', quality: 70 });
      result.pass = true;
      console.log(`[L8] PASS ${cell}: tick ${result.begin.tick} -> ${result.final.tick}, ${result.wallSeconds.toFixed(1)}s wall, ${result.final.renderedFrames - result.begin.renderedFrames} rendered frames`);
    } catch (error) {
      result.error = error instanceof Error ? error.stack ?? error.message : String(error);
      await page.screenshot({ path: `${out}/${cell}-error.jpg`, type: 'jpeg', quality: 70 }).catch(() => {});
      console.error(`[L8] FAIL ${cell}: ${result.error}`);
    } finally {
      cells.push(result); guard.dispose(); await context.close();
      writeFileSync(`${out}/four-cells.json`, JSON.stringify({ ...identity, pass: cells.length === 4 && cells.every(row => row.pass), cells }, null, 2) + '\n');
    }
  }
} finally { await browser?.close(); server.kill('SIGTERM'); }
assert(cells.length === 4 && cells.every(row => row.pass), 'All four L8 cells must pass');
