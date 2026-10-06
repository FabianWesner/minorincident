import { expect, test } from './fixtures';
import { menuUrl } from './ui-helpers';
test('T-E14-03-mouse @E14 @E14-AC03 @smoke title to gameplay, pause, settings and Resume with mouse only', async ({ page }) => {
  await page.goto(menuUrl);
  await expect(page.getByTestId('menu-title')).toBeVisible();
  await page.getByTestId('start-game').click();
  await page.getByTestId('character-female').click();
  await page.getByTestId('level-L1').click();
  await expect(page.getByTestId('mission-panel')).toBeVisible();
  await page.getByRole('button', { name: 'Begin mission' }).click();
  await expect(page.getByTestId('pause-button')).toBeVisible();
  await page.getByTestId('pause-button').click();
  await page.getByTestId('pause-settings').click();
  await page.getByTestId('setting-cameraShake').uncheck();
  await page.getByTestId('settings-back').click();
  await page.getByTestId('resume-game').click();
  await expect(page.getByTestId('menu-pause')).toBeHidden();
  await expect(page.getByTestId('pause-button')).toBeVisible();
});
