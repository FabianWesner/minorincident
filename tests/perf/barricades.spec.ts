import { mkdirSync, writeFileSync } from 'node:fs';
import { boot, expect, test } from '../e2e/fixtures';
test.use({ channel: 'chrome', headless: true, launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-frame-rate-limit', '--disable-gpu-vsync'] } });
for (const tier of ['high', 'low'] as const) test(`E26 @E26 @perf ${tier} 60 awake props + 30 infected attack frame measurement`, async ({ page }) => {
  test.setTimeout(90_000);
  if (tier === 'low') await page.setViewportSize({ width: 390, height: 844 });
  await boot(page, `/?test=1&renderer=webgl&quality=${tier}&audio=muted&dpr=1`);
  const result = await page.evaluate(async () => {
    const a = window.__SS__!; await a.loadScenario('barricade-stress'); a.cheats.god(true); await a.screenshotReady(); a.resume();
    const times: number[] = [], awake: number[] = [], sim: number[] = []; let previous = 0;
    const start = performance.now();
    while (performance.now() - start < 8000) {
      const now = await new Promise<number>(resolve => requestAnimationFrame(resolve));
      if (previous && performance.now() - start > 2000) { times.push(now - previous); awake.push(a.perf().awakeProps); sim.push(a.perf().simMs); } previous = now;
    }
    const p95 = (v: number[]) => [...v].sort((a, b) => a - b)[Math.ceil(v.length * .95) - 1];
    const gl = document.querySelector('canvas')!.getContext('webgl2')!, ext = gl.getExtension('WEBGL_debug_renderer_info');
    return { frameP95: p95(times), simP95: p95(sim), minAwake: Math.min(...awake), maxAwake: Math.max(...awake), infected: a.getState().ai!.count, attacks: a.events(-1).filter(e => e.type === 'infected.attack' && e.special === 'barricade').length, perf: a.perf(), gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null, frameMs: times, emulated: true };
  });
  mkdirSync('test-results/epics/E26', { recursive: true }); writeFileSync(`test-results/epics/E26/perf-${tier}.json`, JSON.stringify(result, null, 2));
  expect(result.minAwake).toBe(60); expect(result.infected).toBe(30); expect(result.attacks).toBeGreaterThanOrEqual(30);
  expect(result.frameP95).toBeLessThanOrEqual(tier === 'high' ? 16.7 : 33.4); expect(result.simP95).toBeLessThanOrEqual(tier === 'high' ? 4 : 6);
});
