import { mkdirSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { PNG } from 'pngjs';

/** Count clipped display pixels only inside the depth-tested courier ID silhouette. */
export async function courierClipping(page: Page, out?: string) {
  if (out) mkdirSync(out, { recursive: true });
  await page.evaluate(() => window.__SS__!.screenshotReady());
  const image = PNG.sync.read(await page.locator('canvas').first().screenshot(out ? { path: `${out}/courier.png` } : {}));
  await page.evaluate(async () => { window.__SS__!.settings.set({ idPass: true }); await window.__SS__!.screenshotReady(); });
  const mask = PNG.sync.read(await page.locator('canvas').first().screenshot(out ? { path: `${out}/courier-mask.png` } : {}));
  await page.evaluate(async () => { window.__SS__!.settings.set({ idPass: false }); await window.__SS__!.screenshotReady(); });
  let pixels = 0, clipped = 0;
  for (let i = 0; i < mask.data.length; i += 4) {
    if (mask.data[i] <= 240 || mask.data[i + 1] >= 20 || mask.data[i + 2] <= 240) continue;
    pixels++;
    if (Math.max(image.data[i], image.data[i + 1], image.data[i + 2]) / 255 >= .97) clipped++;
  }
  return { pixels, clipped, clippedShare: clipped / pixels };
}
