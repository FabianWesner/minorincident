# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: perf/e18-counters.spec.ts >> T-E18-01-low-perf-l5-aftermath @E18-AC01 @perf fixed camera deterministic counters stay in tier budgets
- Location: tests/perf/e18-counters.spec.ts:6:3

# Error details

```
Error: expect(received).toBeLessThanOrEqual(expected)

Expected: <= 500000
Received:    565883
```

# Page snapshot

```yaml
- generic [ref=e2]:
  - generic:
    - generic: Unbar the cellar door · 4 m
    - generic "Objective minimap": N ▲
    - generic "Objective direction": ➜
    - status: Hours later.
    - generic: "New objective: Unbar the cellar door"
```

# Test source

```ts
  1  | import { mkdirSync, writeFileSync } from 'node:fs';
  2  | import { boot, test, expect } from '../e2e/fixtures';
  3  | import { qualityBudgets } from '../../src/core/Quality';
  4  | const output = 'test-results/epics/E18';
  5  | for (const tier of ['high', 'low'] as const) for (const scenario of ['perf-horde-200', 'perf-l6-mainstreet', 'perf-l5-aftermath']) {
  6  |   test(`T-E18-01-${tier}-${scenario} @E18-AC01 @perf fixed camera deterministic counters stay in tier budgets`, async ({ page }) => {
  7  |     test.setTimeout(180_000); await boot(page);
  8  |     const name = scenario === 'perf-horde-200' && tier === 'low' ? 'perf-horde-100' : scenario;
  9  |     const proof = await page.evaluate(async ({ name, tier }) => {
  10 |       const a = window.__SS__!; a.settings.set({ quality: tier }); await a.loadScenario(name); a.pause();
  11 |       if (name.startsWith('perf-horde')) a.camera.preset('perf-horde');
  12 |       await a.screenshotReady(); const first = a.perf(); await a.screenshotReady();
  13 |       return { first, second: a.perf(), state: a.getState() };
  14 |     }, { name, tier });
  15 |     mkdirSync(output, { recursive: true }); writeFileSync(`${output}/${name}-${tier}.json`, JSON.stringify(proof, null, 2));
  16 |     expect(proof.first.drawCalls).toBe(proof.second.drawCalls); expect(proof.first.triangles).toBe(proof.second.triangles);
  17 |     expect(proof.second.quality.tier).toBe(tier); expect(proof.state.render.lighting!.shadowSize).toBe(qualityBudgets[tier].shadowSize); if (proof.state.render.postFx) expect(proof.state.render.postFx.bloomMips).toBe(qualityBudgets[tier].bloomMips); expect(proof.second.drawCalls).toBeGreaterThan(0);
> 18 |     expect(proof.second.drawCalls).toBeLessThanOrEqual(qualityBudgets[tier].drawCalls); expect(proof.second.triangles).toBeLessThanOrEqual(qualityBudgets[tier].triangles);
     |                                                                                                                        ^ Error: expect(received).toBeLessThanOrEqual(expected)
  19 |     expect(proof.state.ai!.count).toBe(qualityBudgets[tier].infected); expect(proof.state.ai!.cap).toBe(qualityBudgets[tier].infected);
  20 |     await page.locator('canvas').screenshot({ path: `${output}/${name}-${tier}.png` });
  21 |   });
  22 | }
  23 |
```
