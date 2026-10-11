import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect, boot } from '../fixtures';

/** Scene Lab's capsule metric on the shipped campaign populations and prop sets. */
for (const level of ['L1', 'L2', 'L3', 'L4', 'L5', 'L6']) test(`${level} crowd clears resting street furniture`, async ({ page }) => {
  test.setTimeout(300_000);
  await boot(page, '/?test=1&scenelab=1&renderer=webgl&quality=high&audio=muted');
  await page.evaluate(async level => {
    const a = window.__SS__!;
    await a.loadLevel(level); a.pause(); a.missions.begin(); a.cheats.god(true); a.bot.start('complete');
    window.__SCENE__!.samplePropPenetration(true);
  }, level);
  for (let batch = 0; batch < 20; batch++) await page.evaluate(async () => {
    for (let frame = 0; frame < 60; frame++) { await window.__SS__!.step(1); window.__SCENE__!.samplePropPenetration(); }
  });
  const metrics = await page.evaluate(() => window.__SCENE__!.samplePropPenetration());
  const dir = 'test-results/ped-props/campaign'; mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/${level}.json`, JSON.stringify({ level, frames: 1200, metrics }, null, 2));
  expect(metrics.samples).toBeGreaterThan(1200);
  expect(metrics.framesMax, JSON.stringify(metrics.pairs.filter(p => p.max > 2))).toBeLessThanOrEqual(2);
});
