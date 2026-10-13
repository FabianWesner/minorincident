import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { boot, expect, test } from '../e2e/fixtures';
// The quiet gate may queue for a long time. Rebuild after acquiring its locks, before any page loads.
test.beforeAll(() => { execFileSync('npm', ['run', 'build'], { stdio: 'inherit' }); });
test.use({ channel: 'chrome', headless: true, launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-frame-rate-limit', '--disable-gpu-vsync', '--js-flags=--expose-gc', '--enable-precise-memory-info'] } });
for (const profile of ['high', 'low', 'phone'] as const) test(`T-E30-budget @E30-AC20 @perf ${profile} mixed outbreak E18 budgets`, async ({ page, context }) => {
  test.setTimeout(240_000); const low = profile !== 'high', tier = low ? 'low' : 'high';
  if (profile === 'phone') { await page.setViewportSize({ width: 390, height: 844 }); const cdp = await context.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); }
  await boot(page, `/?test=1&renderer=webgl&quality=${tier}&audio=muted&dpr=1`);
  const profiler = process.env.MI_L8_CPU_PROFILE === profile ? await context.newCDPSession(page) : null;
  if (profiler) { await profiler.send('Profiler.enable'); await profiler.send('Profiler.start'); }
  const result = await page.evaluate(async tier => {
    const a = window.__SS__!; await a.loadScenario('perf-l8-mixed-outbreak', { seed: 1 }); a.pause();
    a.settings.set({ slowMotion: false });
    a.camera.cinematic({ position: [-41, 23, 7], target: [-60, .5, -12] }, true);
    await a.screenshotReady(); a.resume();
    const warm = performance.now(); while (performance.now() - warm < 3000) await new Promise(r => requestAnimationFrame(r));
    const frames: number[] = [], sims: number[] = [], simFrames: number[] = []; let prev = 0, draws = 0, triangles = 0, lights = 0, peak = 0;
    const start = performance.now();
    while (performance.now() - start < 8000) {
      const now = await new Promise<number>(r => requestAnimationFrame(r)), p = a.perf();
      // Remove floating subtraction noise (33.300000000001 ms) at a picosecond, below the clock's resolution.
      if (prev) frames.push(Math.round((now - prev) * 1e9) / 1e9); prev = now;
      // E18-AC02 budgets one fixed tick, as measured by its Node runner. A phone render frame can contain several.
      if (p.simTickMs > 0) sims.push(p.simTickMs); simFrames.push(p.simMs);
      draws = Math.max(draws, p.drawCalls); triangles = Math.max(triangles, p.triangles); lights = Math.max(lights, p.lighting?.heroLights ?? 0); peak = Math.max(peak, p.infected!.count);
    }
    a.pause(); const p95 = (v: number[]) => v.sort((a,b) => a-b)[Math.ceil(v.length * .95) - 1];
    const all = a.query({});
    return { tier, frameP95: p95(frames), simP95: p95(sims), simFrameP95: p95(simFrames), draws, triangles, lights, peak, heapMB: 0,
      species: Object.fromEntries(['lion','gorilla','elephant','zebra','flamingo','alpha','runner'].map(s => [s, all.filter(e => e.archetype === `infected.${s}`).length])), perf: a.perf() };
  }, tier);
  if (profiler) { const cpu = await profiler.send('Profiler.stop'); writeFileSync(`/tmp/l8-cpu-${profile}.json`, JSON.stringify(cpu.profile)); }
  const cdp = await context.newCDPSession(page);
  // As in the existing L7 budget gate, settle deferred ArrayBuffer collection across task boundaries.
  for (let i = 0; i < 3; i++) { await cdp.send('HeapProfiler.collectGarbage'); await page.evaluate(() => new Promise(r => requestAnimationFrame(r))); }
  const heapAudit = await cdp.send('Runtime.getHeapUsage');
  // E18 memory gates use Runtime.getHeapUsage.usedSize for the JS heap;
  // performance.memory also includes Rapier WASM and geometry ArrayBuffer backing stores.
  result.heapMB = heapAudit.usedSize / 1_000_000;
  mkdirSync('test-results/epics/E30', { recursive: true }); writeFileSync(`test-results/epics/E30/perf-${profile}.json`, JSON.stringify({ ...result, heapAudit }, null, 2)); console.log(JSON.stringify({ ...result, perf: undefined, heapAudit }));
  expect(result.peak).toBe(low ? 100 : 200); for (const count of Object.values(result.species)) expect(count).toBeGreaterThan(0);
  expect(result.frameP95).toBeLessThanOrEqual(low ? 33.3 : 16.7); expect(result.simP95).toBeLessThanOrEqual(low ? 6 : 4);
  expect(result.draws).toBeLessThanOrEqual(low ? 300 : 600); expect(result.triangles).toBeLessThanOrEqual(low ? 500000 : 1500000); expect(result.heapMB).toBeLessThanOrEqual(low ? 250 : 400); expect(result.lights).toBeLessThanOrEqual(low ? 3 : 8);
});
