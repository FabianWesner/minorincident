import { expect, test } from './fixtures';
import { menuUrl } from './ui-helpers';
test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
test('T-E14-03-touch @E14 @E14-AC03 touch-only full menu flow', async ({ page }) => {
  await page.goto(menuUrl); await expect(page.getByTestId('menu-title')).toBeVisible();
  for (const id of ['start-game', 'character-female', 'level-L1', 'mission-button']) await page.getByTestId(id).tap();
  await expect(page.getByTestId('pause-button')).toBeVisible();
  for (const id of ['pause-button', 'pause-settings', 'settings-back', 'resume-game']) await page.getByTestId(id).tap();
  await expect(page.getByTestId('menu-pause')).toBeHidden(); await expect(page.getByTestId('pause-button')).toBeVisible();
});
