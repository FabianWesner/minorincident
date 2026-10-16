import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect, boot } from '../e2e/fixtures';
import { qualityBudgets } from '../../src/core/Quality';

test.use({ channel: 'chrome', headless: true, launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-frame-rate-limit', '--disable-gpu-vsync'] } });
for (const tier of ['high', 'low'] as const) test(`T-E28-10 @E28 @E28-AC10 @perf storm-street precipitation ${tier}`, async ({ page }) => {
  await boot(page, `/?test=1&renderer=webgl&quality=${tier}&dpr=1&audio=muted&profile`);
  await page.evaluate(async () => { const a = window.__SS__!; await a.loadScenario('storm-street', { seed: 28 }); a.pause(); await a.step(200); await a.screenshotReady(); });
  const p = await page.evaluate(() => ({ perf: window.__SS__!.perf(), weather: window.__SS__!.getState().render.weather }));
  expect(p.weather!.particles).toBe(tier === 'high' ? 20_000 : 6000);
  expect(p.perf.drawCalls).toBeLessThanOrEqual(tier === 'high' ? 600 : 300); expect(p.perf.triangles).toBeLessThanOrEqual(tier === 'high' ? 1_500_000 : 500_000);
  const dir = 'test-results/epics/E28/perf'; mkdirSync(dir, { recursive: true }); writeFileSync(`${dir}/storm-${tier}.json`, JSON.stringify(p, null, 2));
});

for (const tier of ['high', 'low'] as const) test(`T-E28-10-frame @E28 @E28-AC10 @perf storm-street ${tier} native E18 frame, sim and heap budgets`, async ({ page, context }) => {
  if (tier === 'low') {
    await page.setViewportSize({ width: 390, height: 844 });
    await (await context.newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: 4 });
  }
  await boot(page, `/?test=1&renderer=webgl&quality=${tier}&dpr=${tier === 'high' ? 1 : 1.5}&audio=muted&profile`);
  const result = await page.evaluate(async () => {
    const a = window.__SS__!; await a.loadScenario('storm-street', { seed: 28 }); a.pause(); a.cheats.god(true);
    await a.step(3600); await a.screenshotReady(); a.resume(); // Fully wet: include reflections/puddles, not only dry rain particles.
    const frames: number[] = [], sim: number[] = []; let prior = a.perf().renderedFrames, warm = 120, previous = 0, started = 0;
    while (frames.length < 600 || !started || performance.now() - started < 12_000) {
      const now = await new Promise<number>(resolve => requestAnimationFrame(resolve)); const p = a.perf();
      if (p.renderedFrames === prior) continue; prior = p.renderedFrames;
      const elapsed = now - previous; previous = now;
      if (warm > 0) { warm--; continue; }
      if (!started) started = performance.now();
      frames.push(elapsed); sim.push(p.simMs);
    }
    const p95 = (values: number[]) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * .95) - 1];
    const gl = document.querySelector('canvas')!.getContext('webgl2')!, extension = gl.getExtension('WEBGL_debug_renderer_info');
    return { frames, sim, frameP95: p95(frames), frameMax: Math.max(...frames), simP95: p95(sim), perf: a.perf(), weather: a.getState().render.weather, wetness: a.getState().weather!.wetness,
      gpu: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) as string : null, durationMs: performance.now() - started };
  });
  const dir = 'test-results/epics/E28/perf'; mkdirSync(dir, { recursive: true }); writeFileSync(`${dir}/storm-native-${tier}.json`, JSON.stringify(result, null, 2));
  expect(result.perf.backend).toBe('webgl'); expect(result.perf.quality.tier).toBe(tier);
  expect(result.gpu).not.toBeNull(); expect(result.gpu!).not.toMatch(/swiftshader|llvmpipe|software/i);
  expect(result.wetness).toBeGreaterThanOrEqual(.8);
  expect(result.frameP95).toBeLessThanOrEqual(qualityBudgets[tier].frameMs);
  expect(result.simP95).toBeLessThanOrEqual(qualityBudgets[tier].simMs);
  expect(result.perf.heapBytes).not.toBeNull(); expect(result.perf.heapBytes! / 1024 ** 2).toBeLessThanOrEqual(qualityBudgets[tier].heapMB);
  expect(result.weather!.particles).toBe(tier === 'high' ? 20_000 : 6000);
  expect(result.perf.drawCalls).toBeLessThanOrEqual(qualityBudgets[tier].drawCalls); expect(result.perf.triangles).toBeLessThanOrEqual(qualityBudgets[tier].triangles);
});
