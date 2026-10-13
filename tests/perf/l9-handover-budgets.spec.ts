import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect, boot } from '../e2e/fixtures';
test.use({ launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-frame-rate-limit', '--disable-gpu-vsync'] } });
for (const quality of ['high','low'] as const) test(`@perf @E31-AC19 S7 axe-only opening ${quality} E18 budgets`, async ({ page, context }) => {
  test.setTimeout(180_000);
  await boot(page, `/?test=1&renderer=webgl&quality=${quality}&audio=muted&dpr=1`);
  const result = await page.evaluate(async quality => {
    const a = window.__SS__!; await a.loadLevel('L10', { seed: 31 });
    a.resume(); const warm = performance.now(); while (performance.now() - warm < 3000) await new Promise(r => requestAnimationFrame(r));
    const frames: number[] = [], sims: number[] = []; let previous = 0, draws = 0, triangles = 0, peak = 0;
    const start = performance.now();
    while (performance.now() - start < 5000) {
      const now = await new Promise<number>(r => requestAnimationFrame(r)), p = a.perf();
      if (previous) frames.push(Math.round((now - previous) * 1e9) / 1e9); previous = now;
      if (p.simTickMs > 0) sims.push(p.simTickMs);
      draws = Math.max(draws, p.drawCalls); triangles = Math.max(triangles, p.triangles); peak = Math.max(peak, p.infected?.count ?? 0);
    }
    a.pause(); const p95 = (v: number[]) => v.sort((a,b) => a-b)[Math.ceil(v.length * .95)-1];
    return { quality, frameP95: p95(frames), simP95: p95(sims), draws, triangles, peak };
  }, quality);
  const cdp = await context.newCDPSession(page); await cdp.send('HeapProfiler.collectGarbage'); const heap = await cdp.send('Runtime.getHeapUsage');
  const heapMB = heap.usedSize / 1e6;
  mkdirSync('test-results/epics/E31/S7/perf', { recursive: true }); writeFileSync(`test-results/epics/E31/S7/perf/${quality}.json`, JSON.stringify({ ...result, heapMB }, null, 2));
  expect(result.frameP95).toBeLessThanOrEqual(quality === 'low' ? 33.3 : 16.7); expect(result.simP95).toBeLessThanOrEqual(quality === 'low' ? 6 : 4);
  expect(result.draws).toBeLessThanOrEqual(quality === 'low' ? 300 : 600); expect(result.triangles).toBeLessThanOrEqual(quality === 'low' ? 500000 : 1500000);
  expect(result.peak).toBeLessThanOrEqual(quality === 'low' ? 100 : 200); expect(heapMB).toBeLessThanOrEqual(quality === 'low' ? 250 : 400);
});
