// Needs a build with BUILD_SPIKES=1 (the lighting spike page is not part of the production dist).
import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from '../e2e/fixtures';

test.use({ launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu'] } });
test('T-E25-01-GPU @E25-AC01 @perf comparative production light-field, DynamicLighting and ClusteredLighting WebGPU spike', async ({ page }) => {
  test.setTimeout(300_000);
  const out = 'test-results/epics/E25/spike'; mkdirSync(out, { recursive: true });
  const comparisons = [];
  for (const lights of [16, 256]) for (const mode of ['field', 'dynamic', 'clustered']) {
    await page.goto(`/preview/lighting-spike.html?mode=${mode}&lights=${lights}`);
    await page.waitForFunction(() => !!window.__LIGHT_SPIKE__);
    const result = await page.evaluate(() => window.__LIGHT_SPIKE__!.measure());
    comparisons.push(result);
    writeFileSync(`${out}/comparisons.json`, JSON.stringify(comparisons, null, 2));
    expect(result.backend).toBe('WebGPUBackend'); expect(result.samples).toHaveLength(120);
    expect(result.counters.draws).toBeGreaterThan(0); expect(result.counters.triangles).toBeGreaterThan(0);
    expect(result.samples.every(s => Number.isFinite(s.submitMs) && Number.isFinite(s.completedMs))).toBe(true);
    await page.locator('canvas').screenshot({ path: `${out}/${mode}-${lights}.png` });
  }
});
