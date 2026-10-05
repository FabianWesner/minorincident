import { mkdirSync, writeFileSync } from 'node:fs';
import { boot, expect, test } from '../e2e/fixtures';

test('T-E01-perf @E01 @perf foundation counters report a plane and cube', async ({ page }) => {
  await boot(page);
  const baseline = await page.evaluate(async () => {
    await window.__SS__!.unloadScenario(); await window.__SS__!.screenshotReady(); return window.__SS__!.perf();
  });
  await page.evaluate(async () => { await window.__SS__!.loadScenario('empty'); window.__SS__!.pause(); });
  await page.evaluate(async () => { await window.__SS__!.step(600); await window.__SS__!.screenshotReady(); });
  const perf = await page.evaluate(() => window.__SS__!.perf());
  // The renderer owns a shared background quad; count scenario resources above it.
  expect(perf.entities).toBe(1); expect(perf.geometries - baseline.geometries).toBe(2); expect(perf.textures).toBe(baseline.textures);
  expect(perf.drawCalls - baseline.drawCalls).toBe(2); expect(perf.triangles - baseline.triangles).toBe(14);
  mkdirSync('test-results/perf', { recursive: true }); writeFileSync('test-results/perf/empty.json', JSON.stringify(perf, null, 2) + '\n');
});
