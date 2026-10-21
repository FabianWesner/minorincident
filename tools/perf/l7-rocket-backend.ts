/** Backend companion to the unchanged L7 rocket acceptance fixture.
 * Same evaluation body, 3 s warmup, 8 s window, refill/heap helpers and literal gates.
 * The stock spec forces WebGL; this runner adds WebGPU without editing it.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';
import { boot, attachErrorGuard } from '../../tests/e2e/fixtures';
import { collectedHeap } from '../../tests/perf/collected-heap';

if (process.env.MI_PERF_LOCK_HELD !== '1') throw Error('Use tools/perf/quiet-run.sh');
const port = Number(process.env.E2E_PORT ?? 3971);
if (port === 3300) throw Error('Use a private preview port');
const out = process.env.L7_ROCKET_OUT ?? 'test-results/l7-perf/rocket-webgpu';
mkdirSync(out, { recursive: true });
const server = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort', '--configLoader', 'runner', ...(process.env.L7_ROCKET_DIST ? ['--outDir', process.env.L7_ROCKET_DIST] : [])], { stdio: 'ignore' });
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(`http://127.0.0.1:${port}`)).ok) break; } catch { /* starting */ }
    await new Promise(r => setTimeout(r, 250));
  }
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-frame-rate-limit', '--disable-gpu-vsync', '--js-flags=--expose-gc', '--enable-precise-memory-info'] });
  for (const tier of ['high', 'low'] as const) {
    const context = await browser.newContext({ baseURL: `http://127.0.0.1:${port}`, viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
    try {
      const page = await context.newPage(), guard = attachErrorGuard(page);
      page.setDefaultTimeout(180_000);
      await page.addInitScript('globalThis.__name = (fn) => fn');
      if (tier === 'low') {
        await page.setViewportSize({ width: 390, height: 844 });
        const cdp = await context.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      }
      await boot(page, `/?test=1&renderer=webgpu&quality=${tier}&audio=muted&dpr=1&profile=1`);
      expect(await page.evaluate(() => window.__SS__!.perf().backend)).toBe('webgpu');
      const result = await page.evaluate(async tier => {
    const a = window.__SS__!, cap = tier === 'high' ? 200 : 100;
    await a.loadScenario(tier === 'high' ? 'perf-horde-200' : 'perf-horde-100'); a.cheats.god(true); a.camera.preset('perf-horde');
    a.settings.set({ slowMotion: false }); await a.screenshotReady(); a.resume();
    const warm = performance.now(); while (performance.now() - warm < 3000) await new Promise(r => requestAnimationFrame(r));
    a.pause(); (window as unknown as { gc(): void }).gc();
    for (let i = 0; i < 2; i++) await new Promise(requestAnimationFrame);
    a.resume();
    const frames: number[] = [], sims: number[] = [], draws: number[] = [], triangles: number[] = [], heaps: number[] = [], particles: number[] = [], puffs: number[] = [], debris: number[] = [], gibs: number[] = [];
    const hitches: { ms: number; elapsed: number; sim: number; update: number; render: number; builds: number }[] = [];
    let previous = 0, lastBlast = 0, lastProbe = 0, peakInfected = 0, blasts = 0;
    const start = performance.now();
    while (performance.now() - start < 8000) {
      const now = await new Promise<number>(r => requestAnimationFrame(r));
      if (previous) frames.push(now - previous); previous = now;
      const perf = a.perf();
      if (frames.at(-1)! > 40) hitches.push({ ms: frames.at(-1)!, elapsed: now - start, sim: perf.simMs, update: perf.updateCpuMs, render: perf.renderCpuMs, builds: perf.nodeBuilds });
      if (perf.simTickMs > 0) sims.push(perf.simTickMs); draws.push(perf.drawCalls); triangles.push(perf.triangles); heaps.push(perf.heapBytes ?? 0);

      if (now - lastBlast >= 1250) {
        const target = perf.infected!.firstLiveId;
        const at = target === null ? { x: 10, z: 0 } : a.getEntity(target)!.transform;
        a.explosions.blast('explosion.rocket', at); blasts++; lastBlast = now;

      }
      // Read counters without cloning every entity, collision and render probe into a debug snapshot.
      if (now - lastProbe >= 100) {
        lastProbe = now;
        const p = a.perf(), ai = p.infected!, vfx = p.effects!;
        debris.push(vfx.blasts.parts); gibs.push(vfx.gibs); particles.push(vfx.particles); puffs.push(vfx.blasts.puffs); peakInfected = Math.max(peakInfected, ai.liveCount);
        const missing = Math.min(cap - ai.liveCount, ai.available);
        for (let i = 0; i < missing; i++) a.spawn('infected.runner', { x: 8 + i % 10 * .5, z: -2 + Math.floor(i / 10) * .25 });
      }
    }
    a.pause();
    const p95 = (values: number[]) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * .95) - 1];
    return { tier, hitches, counterAgreement: a.perf().infected!.liveCount === a.getState().ai!.count && (a.perf().infected!.firstLiveId === null || a.getEntity(a.perf().infected!.firstLiveId!)!.health.current > 0), blasts, peakInfected, frameMax: Math.max(...frames), frameP95: p95(frames), simP95: p95(sims), draws: Math.max(...draws), triangles: Math.max(...triangles), heapMB: 0, peakRawHeapMB: Math.max(...heaps) / 1_000_000, particles: Math.max(...particles), puffs: Math.max(...puffs), debris: Math.max(...debris), gibs: Math.max(...gibs), perf: a.perf() };
      }, tier);
      const heap = await collectedHeap(page, context);
      result.heapMB = heap.heapMB;
      writeFileSync(`${out}/rocket-perf-${tier}-webgpu.json`, JSON.stringify({ backend: 'webgpu', ...result, ...heap }, null, 2));
      console.log(JSON.stringify({ backend: 'webgpu', ...result, ...heap }));
      expect(guard.errors).toEqual([]);
      expect(result.counterAgreement).toBe(true);
  expect(result.blasts).toBeGreaterThanOrEqual(6); expect(result.peakInfected).toBe(tier === 'high' ? 200 : 100);
  expect(result.draws).toBeLessThanOrEqual(tier === 'high' ? 600 : 300); expect(result.triangles).toBeLessThanOrEqual(tier === 'high' ? 1_500_000 : 500_000);
  expect(result.simP95).toBeLessThanOrEqual(tier === 'high' ? 4 : 6); expect(result.heapMB).toBeLessThanOrEqual(tier === 'high' ? 400 : 250);
  expect(result.particles + result.puffs).toBeLessThanOrEqual(tier === 'high' ? 6000 : 2000);
  expect(result.puffs).toBeLessThanOrEqual(tier === 'high' ? 400 : 120);
  expect(result.debris).toBeLessThanOrEqual(tier === 'high' ? 120 : 40); expect(result.gibs).toBeLessThanOrEqual(tier === 'high' ? 80 : 30);
  expect(result.perf.lighting!.heroLights).toBeLessThanOrEqual(tier === 'high' ? 8 : 3); expect(result.perf.awakeProps).toBeLessThanOrEqual(tier === 'high' ? 150 : 60);
  expect(result.frameMax).toBeLessThanOrEqual(50);
  expect(result.frameP95).toBeLessThanOrEqual(tier === 'high' ? 16.7 : 33.3);
      guard.dispose();
    } catch (error) { console.error(error); process.exitCode = 1; }
    finally { await context.close(); }
  }
} finally { await browser?.close(); server.kill(); }
