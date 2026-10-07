import { mkdirSync, writeFileSync } from 'node:fs';
import { test, boot, expect } from '../e2e/fixtures';
import { qualityBudgets } from '../../src/core/Quality';
for (const tier of ['high', 'low'] as const) test(`T-E18-05-${tier} @E18-AC05 @perf five L1/L6 loads release heap and GPU resources`, async ({ page, context }) => {
  test.setTimeout(300_000); await boot(page); await page.evaluate(t => window.__SS__!.settings.set({ quality: t }), tier);
  const cdp = await context.newCDPSession(page), loads = [];
  // Begin the mission so its deferred tiers can stream, then settle that residency
  // through screenshotReady. Comparing an incomplete first load with settled later
  // loads would count deferred assets as leaks. Retire render lists over 12 more frames.
  for (const id of ['L1', 'L6', 'L1', 'L6', 'L1']) {
    await page.evaluate(async id => { const a = window.__SS__!; await a.loadLevel(id); a.missions.begin(); a.pause(); for (let frame = 0; frame < 6; frame++) await a.screenshotReady(); }, id);
    await cdp.send('HeapProfiler.collectGarbage');
    const heap = await cdp.send('Runtime.getHeapUsage');
    loads.push({ id, ...await page.evaluate(() => window.__SS__!.perf()), heapBytes: heap.usedSize });
  }
  const first = loads[0], last = loads[4];
  mkdirSync('test-results/epics/E18', { recursive: true }); writeFileSync(`test-results/epics/E18/memory-${tier}.json`, JSON.stringify(loads, null, 2));
  for (const key of ['heapBytes', 'geometries', 'textures'] as const) expect(last[key], key).toBeLessThanOrEqual(first[key] * 1.1);
  for (const load of loads.filter(l => l.id === 'L6')) expect(load.heapBytes).toBeLessThanOrEqual(qualityBudgets[tier].heapMB * 1_000_000);
});
