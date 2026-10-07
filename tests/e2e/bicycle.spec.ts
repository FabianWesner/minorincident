import { mkdirSync } from 'node:fs';
import { test, expect } from './fixtures';
import { menuStart } from './ui-helpers';
import { tick } from './input-helpers';

// The sim regression checks rack clearance and parking; this view check exercises the real mounted rider.
test('T-E19-16h @E19 @E19-AC16 courier sits on the bike with hands on the handlebar', async ({ page }) => {
  await menuStart(page); await page.evaluate(() => window.__SS__!.pause());
  const bike = await page.evaluate(() => window.__SS__!.getState().entities.find(e => e.bicycle)!.transform);
  await page.evaluate(p => window.__SS__!.teleport('player', { x: p.x + 1, z: p.z }), bike);
  await page.keyboard.press('e'); await tick(page, 1);
  await tick(page, 60);
  expect(await page.evaluate(() => window.__SS__!.getState().entities.find(e => e.bicycle)!.bicycle!.mounted)).toBe(true);
  expect(await page.evaluate(() => window.__SS__!.getState().render.character!.clip)).toBe('ride');
  await page.evaluate(() => window.__SS__!.screenshotReady());
  mkdirSync('test-results/epics/E19', { recursive: true });
  await page.screenshot({ path: 'test-results/epics/E19/courier-bike-rider.png' });
});
