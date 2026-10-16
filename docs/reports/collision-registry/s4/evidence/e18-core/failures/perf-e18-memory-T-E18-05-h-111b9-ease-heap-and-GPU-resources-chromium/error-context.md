# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: perf/e18-memory.spec.ts >> T-E18-05-high @E18-AC05 @perf five L1/L6 loads release heap and GPU resources
- Location: tests/perf/e18-memory.spec.ts:4:46

# Error details

```
Error: heapBytes

expect(received).toBeLessThanOrEqual(expected)

Expected: <= 87733364.4
Received:    96643024
```

# Page snapshot

```yaml
- generic [ref=e2]:
  - generic:
    - generic: Pick up the package at the courier depot · 55 m
    - generic "Objective minimap": N ▲
    - generic "Objective direction": ➜
    - status: Morning! One cold-chain parcel for the Medical Annex on Larch Street. Easy one.
    - generic: "New objective: Pick up the package at the courier depot"
```

# Test source

```ts
  1  | import { mkdirSync, writeFileSync } from 'node:fs';
  2  | import { test, boot, expect } from '../e2e/fixtures';
  3  | import { qualityBudgets } from '../../src/core/Quality';
  4  | for (const tier of ['high', 'low'] as const) test(`T-E18-05-${tier} @E18-AC05 @perf five L1/L6 loads release heap and GPU resources`, async ({ page, context }) => {
  5  |   test.setTimeout(300_000); await boot(page); await page.evaluate(t => window.__SS__!.settings.set({ quality: t }), tier);
  6  |   const cdp = await context.newCDPSession(page), loads = [];
  7  |   // Begin the mission so its deferred tiers can stream, then settle that residency
  8  |   // through screenshotReady. Comparing an incomplete first load with settled later
  9  |   // loads would count deferred assets as leaks. Retire render lists over 12 more frames.
  10 |   for (const id of ['L1', 'L6', 'L1', 'L6', 'L1']) {
  11 |     await page.evaluate(async id => { const a = window.__SS__!; await a.loadLevel(id); a.missions.begin(); a.pause(); for (let frame = 0; frame < 6; frame++) await a.screenshotReady(); }, id);
  12 |     await cdp.send('HeapProfiler.collectGarbage');
  13 |     const heap = await cdp.send('Runtime.getHeapUsage');
  14 |     loads.push({ id, ...await page.evaluate(() => window.__SS__!.perf()), heapBytes: heap.usedSize });
  15 |   }
  16 |   const first = loads[0], last = loads[4];
  17 |   mkdirSync('test-results/epics/E18', { recursive: true }); writeFileSync(`test-results/epics/E18/memory-${tier}.json`, JSON.stringify(loads, null, 2));
> 18 |   for (const key of ['heapBytes', 'geometries', 'textures'] as const) expect(last[key], key).toBeLessThanOrEqual(first[key] * 1.1);
     |                                                                                              ^ Error: heapBytes
  19 |   for (const load of loads.filter(l => l.id === 'L6')) expect(load.heapBytes).toBeLessThanOrEqual(qualityBudgets[tier].heapMB * 1_000_000);
  20 | });
  21 |
```
