import { expect, test } from './fixtures';
import { menuUrl, keyboardActivate } from './ui-helpers';
test('T-E14-03-keyboard @E14 @E14-AC03 keyboard-only full menu flow', async ({ page }) => {
  await page.goto(menuUrl); await expect(page.getByTestId('menu-title')).toBeVisible();
  await keyboardActivate(page, 'start-game'); await keyboardActivate(page, 'character-male'); await keyboardActivate(page, 'level-L1');
  await expect(page.getByTestId('mission-button')).toBeVisible(); await keyboardActivate(page, 'mission-button');
  await expect(page.getByTestId('pause-button')).toBeVisible(); await page.keyboard.press('Escape');
  await keyboardActivate(page, 'pause-settings');
  await keyboardActivate(page, 'settings-back'); await keyboardActivate(page, 'resume-game');
  await expect(page.getByTestId('menu-pause')).toBeHidden(); await expect(page.getByTestId('pause-button')).toBeVisible();
});
