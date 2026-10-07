import { boot, expect, test } from './fixtures';

test.use({ video: { mode: 'on', size: { width: 960, height: 540 } } });
test('T-E09-driving-video @E09 keyboard acceleration, turn, handbrake and braking review', async ({ page }) => {
  await boot(page);
  await page.evaluate(async () => { const a = window.__SS__!; await a.loadScenario('drive-course'); a.pause(); await a.step(60); await a.screenshotReady(); a.resume(); });
  await page.keyboard.down('KeyW'); await page.waitForTimeout(3000);
  await page.keyboard.down('KeyA'); await page.waitForTimeout(1500);
  await page.keyboard.down('KeyK'); await page.waitForTimeout(800);
  await page.keyboard.up('KeyK'); await page.keyboard.up('KeyA'); await page.waitForTimeout(1700);
  await page.keyboard.up('KeyW');
  await page.evaluate(() => window.__SS__!.input.set({ brake: true }));
  await page.waitForTimeout(2000);
  const car = await page.evaluate(() => { window.__SS__!.pause(); return window.__SS__!.getEntity(2)!; });
  expect(Math.hypot(car.transform.x, car.transform.z)).toBeGreaterThan(20);
  expect(car.vehicle!.speed).toBeLessThan(.1);
  await page.screenshot({ path: 'test-results/vehicle-feel/driving.png' });
});
