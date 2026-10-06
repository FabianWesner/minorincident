import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, devices } from '@playwright/test';
import { lookViewpoints } from '../../src/data/lookViewpoints';
import { attachErrorGuard } from '../../tests/e2e/fixtures';
import { gpuArgs, output, prepareReview } from './sheets';

const start = performance.now();
const port = Number(process.env.E2E_PORT ?? 3306);
const baseURL = process.env.LOOK_URL ?? `http://127.0.0.1:${port}`;
let server: ReturnType<typeof spawn> | undefined;
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  if (!process.env.LOOK_URL) {
    if (process.env.LOOK_SKIP_BUILD !== '1') {
      const build = spawnSync('npm', ['run', 'build'], { stdio: 'inherit' });
      if (build.status !== 0) throw new Error('Production build failed');
    }
    const occupied = await fetch(baseURL).then(() => true, () => false);
    if (occupied) throw new Error(`Port ${port} is occupied; set E2E_PORT or LOOK_URL explicitly.`);
    server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort', '--configLoader', 'runner'], { stdio: 'pipe' });
    server.stderr?.on('data', data => process.stderr.write(data));
    const deadline = performance.now() + 30_000;
    while (!await fetch(baseURL).then(r => r.ok, () => false)) {
      if (server.exitCode !== null || performance.now() > deadline) throw new Error('Production preview did not start');
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  browser = await chromium.launch({ headless: true, args: gpuArgs });
  const measurements = [];
  // One active game page at a time keeps this cheap on the shared Mac.
  for (const mobile of [false, true]) {
    const tier = mobile ? 'portrait' : 'desktop';
    const context = await browser.newContext(mobile
      ? { ...devices['iPhone 14'], viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 }
      : { viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
    try {
      const page = await context.newPage(), guard = attachErrorGuard(page);
      const url = new URL(baseURL);
      for (const [key, value] of Object.entries({ test: '1', renderer: 'webgl', dpr: '1', quality: mobile ? 'low' : 'high', audio: 'muted', seed: '1' })) url.searchParams.set(key, value);
      url.searchParams.delete('lookdev'); url.searchParams.delete('debug');
      await page.goto(url.toString());
      await page.waitForFunction(() => Boolean(window.__SS__), { timeout: 30_000 });
      await page.evaluate(async () => {
        const api = window.__SS__!; await api.ready; api.pause(); await api.loadLevel('L1', { seed: 1 }); api.pause(); api.settings.set({ cameraShake: false });
      });
      await page.addStyleTag({ content: 'body > :not(#game), #game > :not(canvas) { visibility: hidden !important; }' });
      mkdirSync(join(output, tier), { recursive: true });
      for (const spot of lookViewpoints) {
        const state = await page.evaluate(async spot => {
          const api = window.__SS__!; api.teleport('player', spot); api.camera.preset(spot.id); await api.screenshotReady();
          return { tick: api.tick(), camera: api.getState().render.camera, perf: api.perf() };
        }, spot);
        if (!state.perf.paused) throw new Error('Capture must be paused');
        await page.locator('canvas').first().screenshot({ path: join(output, tier, `${spot.id}.png`) });
        measurements.push({ ...spot, tier, seed: 1, ...state });
      }
      if (guard.errors.length) throw new Error(guard.errors.join('\n'));
      guard.dispose();
    } finally { await context.close(); }
  }
  await prepareReview(browser);
  const seconds = (performance.now() - start) / 1000;
  writeFileSync(join(output, 'capture.json'), JSON.stringify({ baseURL, seconds, images: 12, sheets: 6, measurements }, null, 2) + '\n');
  console.log(`Look capture: 12 images + 6 sheets + rubric in ${seconds.toFixed(1)}s → ${output}`);
  if (seconds >= 120) throw new Error('Capture exceeded the two-minute budget');
} finally { await browser?.close(); server?.kill('SIGTERM'); }
