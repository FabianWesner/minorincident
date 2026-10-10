import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect, boot } from './fixtures';

/** Honest inventory of placeholders submitted by the level photo cameras. */
test('T-E17-09-photo @E17 @E17-AC09 level photo spot asset inventory', async ({ page }) => {
  test.setTimeout(600_000);
  await boot(page, '/?test=1&renderer=webgl&quality=high&audio=muted');
  const rows = [];
  for (const level of ['L1', 'L2', 'L3', 'L4', 'L5', 'L6']) {
    await page.evaluate(async level => { const a = window.__SS__!; await a.loadLevel(level); a.pause(); }, level);
    const spots = await page.evaluate(() => window.__SS__!.getState().render.districts!.photoSpots);
    for (const spot of spots) {
      const proof = await page.evaluate(async spot => {
        const a = window.__SS__!; a.camera.preset(spot); await a.screenshotReady();
        const batches = a.getState().render.districts!.batches;
        return { placeholders: [...new Set(batches.filter(b => b.placeholder && b.triangles > 0).map(b => b.assetId))], assets: [...new Set(batches.filter(b => b.triangles > 0).map(b => b.assetId))] };
      }, spot);
      rows.push({ level, spot, ...proof });
    }
  }
  mkdirSync('test-results/epics/E17', { recursive: true });
  writeFileSync('test-results/epics/E17/photo-assets.json', JSON.stringify(rows, null, 2) + '\n');
  expect(rows.filter(r => r.placeholders.length)).toEqual([]);
});
