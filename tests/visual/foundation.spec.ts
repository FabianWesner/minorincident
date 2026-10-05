import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { boot, expect, test } from '../e2e/fixtures';

test('T-E01-visual @E01 @visual paused fixture renders stable pixels', async ({ page }) => {
  await boot(page);
  await page.evaluate(async () => { await window.__SS__!.step(60); await window.__SS__!.screenshotReady(); });
  const first = PNG.sync.read(await page.screenshot());
  await page.evaluate(async () => { await window.__SS__!.screenshotReady(); });
  const second = PNG.sync.read(await page.screenshot({ path: 'test-results/epics/E01/empty.png' }));
  expect(pixelmatch(first.data, second.data, undefined, first.width, first.height, { threshold: 0 })).toBe(0);
  const colors = new Set<string>();
  for (let i = 0; i < first.data.length; i += 400) colors.add(first.data.subarray(i, i + 3).toString('hex'));
  expect(colors.size).toBeGreaterThan(10);
});
