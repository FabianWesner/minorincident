import { mkdirSync, writeFileSync } from 'node:fs';
import { boot, test } from './fixtures';

test('start district delivery measurement', async ({ page }) => {
  test.skip(!process.env.ASSET_DELIVERY_VISUAL, 'Explicit delivery measurement');
  await boot(page);
  await page.evaluate(async () => { await window.__SS__!.loadLevel('D-RES', { seed: 1 }); window.__SS__!.pause(); await window.__SS__!.screenshotReady(); });
  const resources = await page.evaluate(() => performance.getEntriesByType('resource').map(entry => {
    const resource = entry as PerformanceResourceTiming;
    return { path: new URL(resource.name).pathname, bytes: resource.encodedBodySize, transferBytes: resource.transferSize };
  }));
  mkdirSync('test-results/assets', { recursive: true });
  writeFileSync('test-results/assets/start-district-download.json', JSON.stringify({ bytes: resources.reduce((sum, resource) => sum + resource.bytes, 0), resources }, null, 2) + '\n');
});
