import { mkdirSync, writeFileSync } from 'node:fs';
import { boot, test, expect } from '../e2e/fixtures';
import { qualityBudgets } from '../../src/core/Quality';
const output = 'test-results/epics/E18';
for (const tier of ['high', 'low'] as const) for (const scenario of ['perf-horde-200', 'perf-l6-mainstreet', 'perf-l5-aftermath']) {
  test(`T-E18-01-${tier}-${scenario} @E18-AC01 @perf fixed camera deterministic counters stay in tier budgets`, async ({ page }) => {
    test.setTimeout(180_000); await boot(page);
    const name = scenario === 'perf-horde-200' && tier === 'low' ? 'perf-horde-100' : scenario;
    const proof = await page.evaluate(async ({ name, tier }) => {
      const a = window.__SS__!; a.settings.set({ quality: tier }); await a.loadScenario(name); a.pause();
      if (name.startsWith('perf-horde')) a.camera.preset('perf-horde');
      await a.screenshotReady(); const first = a.perf(); await a.screenshotReady();
      return { first, second: a.perf(), state: a.getState() };
    }, { name, tier });
    mkdirSync(output, { recursive: true }); writeFileSync(`${output}/${name}-${tier}.json`, JSON.stringify(proof, null, 2));
    expect(proof.first.drawCalls).toBe(proof.second.drawCalls); expect(proof.first.triangles).toBe(proof.second.triangles);
    expect(proof.second.quality.tier).toBe(tier); expect(proof.state.render.lighting!.shadowSize).toBe(qualityBudgets[tier].shadowSize); if (proof.state.render.postFx) expect(proof.state.render.postFx.bloomMips).toBe(qualityBudgets[tier].bloomMips); expect(proof.second.drawCalls).toBeGreaterThan(0);
    expect(proof.second.drawCalls).toBeLessThanOrEqual(qualityBudgets[tier].drawCalls); expect(proof.second.triangles).toBeLessThanOrEqual(qualityBudgets[tier].triangles);
    expect(proof.state.ai!.count).toBe(qualityBudgets[tier].infected); expect(proof.state.ai!.cap).toBe(qualityBudgets[tier].infected);
    await page.locator('canvas').screenshot({ path: `${output}/${name}-${tier}.png` });
  });
}
test('T-E18-01-low-male @E18-AC01 @perf L5 stress retains its budget with the larger male courier skin', async ({ page }) => {
  test.setTimeout(180_000); await boot(page);
  const proof = await page.evaluate(async () => {
    const a = window.__SS__!; a.settings.set({ quality: 'low' }); await a.loadScenario('perf-l5-aftermath'); a.pause();
    a.survivor.select('male', a.getEntity(1)!.survivor!.gearTier);
    await a.screenshotReady();
    return { perf: a.perf(), state: a.getState() };
  });
  mkdirSync(output, { recursive: true }); writeFileSync(`${output}/perf-l5-aftermath-low-male.json`, JSON.stringify(proof, null, 2));
  expect(proof.state.ai!.count).toBe(100);
  expect(proof.perf.drawCalls).toBeLessThanOrEqual(qualityBudgets.low.drawCalls);
  expect(proof.perf.triangles).toBeLessThanOrEqual(qualityBudgets.low.triangles);
  await page.locator('canvas').screenshot({ path: `${output}/perf-l5-aftermath-low-male.png` });
});
