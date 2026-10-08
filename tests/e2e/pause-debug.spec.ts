import { expect, test } from './fixtures';
import { menuUrl } from './ui-helpers';

test('pause debug panel is query gated and reports L1 state', async ({ page }) => {
  await page.goto(`${menuUrl}&debug=true`);
  await page.getByTestId('start-game').click();
  await page.getByTestId('character-female').click();
  await page.getByTestId('level-L1').click();
  await page.getByRole('button', { name: 'Begin mission' }).click();
  await page.getByTestId('pause-button').click();
  const panel = page.getByTestId('pause-debug');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('Level: L1');
  await expect(panel).toContainText('Player (x, z, y):');
  await expect(panel).toContainText('Step:');
  await expect(page.getByTestId('pause-debug-copy')).toBeVisible();

  await page.goto(menuUrl);
  await page.getByTestId('start-game').click();
  await page.getByTestId('character-female').click();
  await page.getByTestId('level-L1').click();
  await page.getByRole('button', { name: 'Begin mission' }).click();
  await page.getByTestId('pause-button').click();
  await expect(page.getByTestId('menu-pause')).toBeVisible();
  await expect(page.getByTestId('pause-debug')).toHaveCount(0);
});
