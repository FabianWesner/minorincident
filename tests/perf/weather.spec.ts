import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect, boot } from '../e2e/fixtures';
for (const tier of ['high', 'low'] as const) test(`T-E28-10 @E28 @E28-AC10 @perf storm-street precipitation ${tier}`, async ({ page }) => {
  await boot(page, `/?test=1&renderer=webgl&quality=${tier}&dpr=1&audio=muted&profile`);
  await page.evaluate(async () => { const a = window.__SS__!; await a.loadScenario('storm-street', { seed: 28 }); a.pause(); await a.step(200); await a.screenshotReady(); });
  const p = await page.evaluate(() => ({ perf: window.__SS__!.perf(), weather: window.__SS__!.getState().render.weather }));
  expect(p.weather!.particles).toBe(tier === 'high' ? 20_000 : 6000);
  expect(p.perf.drawCalls).toBeLessThanOrEqual(tier === 'high' ? 600 : 300); expect(p.perf.triangles).toBeLessThanOrEqual(tier === 'high' ? 1_500_000 : 500_000);
  const dir = 'test-results/epics/E28/perf'; mkdirSync(dir, { recursive: true }); writeFileSync(`${dir}/storm-${tier}.json`, JSON.stringify(p, null, 2));
});
