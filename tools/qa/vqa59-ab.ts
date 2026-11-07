/** vqa59 (copy of vqa58-corpse-ab, adds plain start views before the kills): same staged corpse ring/pile on a baseline URL (QA env = batch 57) and on local dist (batch 58), WebGPU, low+high, zoom 0.5/1.
 *   E2E_UNITS=1 sh tools/e2e-lock.sh npx tsx tools/qa/vqa58-corpse-ab.ts [baselineUrl] [levels=L1,L3,L10]
 * Captures to test-results/vqa59/ab/. */
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { preview } from 'vite';
import { launchBrowser } from '../browser-pool/client';

const baseline = process.argv[2] ?? 'https://qa.minor-incident.pages.dev', levels = (process.argv[3] ?? 'L1,L4,L5').split(',');
const out = 'test-results/vqa59/ab'; mkdirSync(out, { recursive: true });
const port = Number(process.env.E2E_PORT ?? 4359);
const server = await preview({ configFile: false, build: { outDir: resolve('dist') }, preview: { host: '127.0.0.1', port, strictPort: true } });
const presets: Record<string, string | undefined> = { L1: undefined, L3: 'L3-default', L4: 'L4-default', L5: 'L5-default', L7: 'L7-default', L10: 'L10-default' };
const browser = await launchBrowser({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
try {
  for (const [side, origin] of [['b57', baseline], ['b59', `http://127.0.0.1:${port}`]] as const) for (const tier of (process.env.VQA_TIERS ?? 'low,high').split(',')) {
    if (!(process.env.VQA_SIDES ?? 'b57,b59').split(',').includes(side)) continue;
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    const page = await context.newPage(); page.setDefaultTimeout(180000); await page.addInitScript('globalThis.__name = fn => fn');
    const u = new URL(origin); for (const [k, v] of Object.entries({ test: '1', scenelab: '1', dpr: '1', quality: tier, audio: 'muted', preload: '0', seed: '1' })) u.searchParams.set(k, v);
    await page.goto(u.toString(), { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.__SS__, null, { timeout: 120000 });
    await page.evaluate(async () => { await window.__SS__!.ready; window.__SS__!.pause(); });
    await page.addStyleTag({ content: '#hud,.hud,.story-bubble,.mission-subtitle,[data-testid=mission-button],.telemetry-consent{visibility:hidden!important}' });
    for (const level of levels) {
      await page.evaluate(async ({ level, tier, progression }) => {
        const a = window.__SS__!; a.settings.set({ quality: tier as 'low', cameraShake: false });
        await a.loadLevel(level, { seed: 1, ...(progression ? { progression } : {}) } as never);
        a.missions.begin(); a.pause(); a.camera.follow(); a.cheats.god(true); await a.step(60);
      }, { level, tier, progression: presets[level] });
      for (const zoom of [1, 1.5]) {
        await page.evaluate(async zoom => { const a = window.__SS__!; a.camera.zoom(zoom); for (let i = 0; i < 3; i++) await a.step(10); await a.screenshotReady(); }, zoom);
        await page.screenshot({ path: `${out}/${level}-plain-${tier}-z${zoom}-${side}.jpg`, type: 'jpeg', quality: 88 });
      }
      await page.evaluate(async () => {
        const a = window.__SS__!;
        const p = a.getEntity(1)!.transform as { x: number; z: number }, x = p.x, z = p.z;
        a.cheats.killAll(); await a.step(30);
        for (let i = 0; i < 8; i++) { const t = i / 8 * Math.PI * 2; try { a.spawn(i % 3 === 2 ? 'infected.brute' : 'infected.runner', { x: x + Math.cos(t) * 3.5, z: z + Math.sin(t) * 3.5 }); } catch { /* blocked */ } }
        for (let i = 0; i < 7; i++) try { a.spawn('infected.runner', { x: x + 5 + (i % 3) * .3, z: z + Math.floor(i / 3) * .3 }); } catch { /* blocked */ }
        try { a.spawn('infected.alpha', { x: x - 6, z }); } catch { /* blocked */ }
        await a.step(20); a.cheats.killAll(); await a.step(240); a.cheats.killAll(); await a.step(240);
      });
      for (const zoom of [1, 1.5]) {
        await page.evaluate(async zoom => { const a = window.__SS__!; a.camera.zoom(zoom); for (let i = 0; i < 3; i++) await a.step(10); await a.screenshotReady(); }, zoom);
        await page.screenshot({ path: `${out}/${level}-${tier}-z${zoom}-${side}.jpg`, type: 'jpeg', quality: 88 });
      }
    }
    await context.close();
  }
} finally { await browser.close(); await server.close(); }
