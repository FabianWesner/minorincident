import { expect, test } from './fixtures';
import { menuStart } from './ui-helpers';

test.use({ hasTouch: true });
test('@E02 @E02-AC04 portrait resize keeps the survivor and nearby threats out of distance fog', async ({ page }) => {
  await menuStart(page);
  await page.evaluate(() => window.__SS__!.pause());
  await page.setViewportSize({ width: 412, height: 915 });
  const box = await page.getByTestId('touch-right').boundingBox(); expect(box).not.toBeNull();
  await page.touchscreen.tap(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.evaluate(async () => { await window.__SS__!.step(45); await window.__SS__!.screenshotReady(); });
  const render = await page.evaluate(() => window.__SS__!.getState().render);
  const camera = render.camera, lighting = render.lighting!;
  const distance = Math.hypot(...camera.position.map((v, i) => v - camera.focus[i]));
  expect(lighting.fogNear).toBeGreaterThan(distance + 20);
  expect(lighting.fogFar - lighting.fogNear).toBeCloseTo(105, 8);
  await page.screenshot({ path: 'test-results/playtest/portrait-fog-fixed.png' });
  await page.setViewportSize({ width: 915, height: 412 });
  await page.evaluate(() => window.__SS__!.screenshotReady());
  const landscape = await page.evaluate(() => window.__SS__!.getState().render);
  expect(landscape.lighting!.fogNear - landscape.camera.radius).toBeCloseTo(lighting.fogNear - camera.radius);
  expect(landscape.lighting!.fogFar - landscape.lighting!.fogNear).toBeCloseTo(105, 8);
});
