import { readFileSync } from 'node:fs';
import { test, expect, boot, testUrl } from '../fixtures';
import type { SceneSpec } from '../../../src/debug/scenelab/spec';

const scene = JSON.parse(readFileSync('tests/scenes/catalog/l3-base-rendezvous.json', 'utf8')) as SceneSpec;
test('PO-10b/11 @E21 @E21-AC17 seed 1 base arrival shows countdown, closes the boom and keeps the horde outside', async ({ page }) => {
  test.setTimeout(240_000);
  await boot(page, `${testUrl}&ui=1&scenelab=1`);
  await page.evaluate(spec => window.__SCENE__!.load(spec), scene);
  await page.evaluate(() => window.__SCENE__!.step(1));
  await expect(page.locator('.hud-tracker')).toContainText('Checkpoint reached');
  await expect(page.locator('.hud-tracker')).toContainText('Evacuation in 15 s');
  const arrival = await page.evaluate(() => window.__SS__!.missions.state()!.l3!);
  expect(arrival.crossedAt).toBeGreaterThan(0);
  expect(arrival.barrierClosedAt).toBeGreaterThan(0);
  for (let i = 0; i < 10; i++) {
    await page.evaluate(() => window.__SCENE__!.step(60));
    const inside = await page.evaluate(() => window.__SS__!.query({}).filter(e => e.infected && e.health.current > 0 && e.transform.x > 213.1 && Math.abs(e.transform.z) < 45.6).map(e => e.id));
    expect(inside).toEqual([]);
  }
  await expect(page.locator('.hud-tracker')).toContainText('Evacuation in 5 s');
});
