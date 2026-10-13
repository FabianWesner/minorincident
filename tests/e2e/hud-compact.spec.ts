import { mkdirSync } from 'node:fs';
import { expect, test } from './fixtures';
import { hudStart } from './ui-helpers';
const dir = process.env.HUD_SHOTS ?? 'test-results/hud-cleanup';
async function shot(page: import('@playwright/test').Page, name: string): Promise<void> {
  mkdirSync(dir, { recursive: true }); await page.evaluate(() => window.__SS__!.screenshotReady());
  await page.screenshot({ path: `${dir}/${name}.png` });
}
test('hud-cleanup captures desktop and phone', async ({ page }) => {
  await hudStart(page);
  await page.evaluate(async () => { const a = window.__SS__!; a.setLoadout(['weapon.bat'], ['weapon.kick']); await a.step(2); });
  // Compact panel: no armour bar, no bottom weapon cards, one active-weapon icon with an accessible name.
  await expect(page.getByTestId('armor-bar')).toHaveCount(0);
  await expect(page.getByTestId('slot-cards')).toHaveCount(0);
  await expect(page.getByTestId('weapon-active')).toBeVisible();
  await expect(page.getByTestId('weapon-active')).toHaveAttribute('aria-label', /bat/);
  await expect(page.getByTestId('weapon-active')).toHaveAttribute('data-weapon', 'weapon.bat');
  await shot(page, 'desktop');
  await page.setViewportSize({ width: 390, height: 844 }); await page.evaluate(() => window.__SS__!.step(2)); await shot(page, 'phone');
});
