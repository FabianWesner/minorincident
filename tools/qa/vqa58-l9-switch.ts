/** vqa58: does L9 (L9-default, WebGPU) hang when quality switches low -> high right after Begin? Baseline URL (batch 57) vs local dist (batch 58).
 *   npx tsx tools/qa/vqa58-l9-switch.ts [baselineUrl] [level=L9] */
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { preview } from 'vite';
import { launchBrowser } from '../browser-pool/client';

const baseline = process.argv[2] ?? 'https://qa.minor-incident.pages.dev', level = process.argv[3] ?? 'L9';
const out = 'test-results/vqa58/l9-switch'; mkdirSync(out, { recursive: true });
const port = Number(process.env.E2E_PORT ?? 4359);
const server = await preview({ configFile: false, build: { outDir: resolve('dist') }, preview: { host: '127.0.0.1', port, strictPort: true } });
const browser = await launchBrowser({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
const withTimeout = <T>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<'TIMEOUT'>(r => setTimeout(() => r('TIMEOUT'), ms))]);
try {
  for (const [side, origin] of [['b58', `http://127.0.0.1:${port}`], ['b57', baseline]] as const) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    const page = await context.newPage(); page.setDefaultTimeout(240000); await page.addInitScript('globalThis.__name = fn => fn');
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message)); page.on('crash', () => errors.push('PAGE CRASH'));
    const u = new URL(origin); for (const [k, v] of Object.entries({ test: '1', scenelab: '1', dpr: '1', quality: 'low', audio: 'muted', preload: '0', seed: '1' })) u.searchParams.set(k, v);
    await page.goto(u.toString(), { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.__SS__, null, { timeout: 120000 });
    await page.evaluate(async () => { await window.__SS__!.ready; window.__SS__!.pause(); });
    const t0 = Date.now();
    await page.evaluate(async level => { const a = window.__SS__!; a.settings.set({ quality: 'low' }); await a.loadLevel(level, { seed: 1, progression: `${level}-default` } as never); a.missions.begin(); a.camera.follow(); a.resume(); await new Promise(r => setTimeout(r, 600)); a.pause(); }, level);
    const loaded = Date.now() - t0;
    const steps: unknown[] = [];
    for (const q of ['high', 'low', 'high'] as const) {
      const t = Date.now();
      const r = await withTimeout(page.evaluate(async q => { const a = window.__SS__!; a.settings.set({ quality: q }); a.camera.zoom(1.5); await a.screenshotReady(); return 'ok'; }, q), 180000);
      steps.push({ q, result: r, ms: Date.now() - t });
      if (r === 'TIMEOUT') break;
      await page.screenshot({ path: `${out}/${level}-${side}-${q}-${steps.length}.jpg`, type: 'jpeg', quality: 80 });
    }
    console.log(JSON.stringify({ side, level, loadedMs: loaded, steps, errors: errors.slice(0, 5) }));
    await context.close().catch(() => undefined);
  }
} finally { await browser.close(); await server.close(); }
