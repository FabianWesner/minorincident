import { expect, type Page } from '@playwright/test';
export const menuUrl = '/?test=1&ui=1&renderer=webgl&dpr=1&quality=high&audio=muted&seed=1';
/** Verify real focus navigation; never inject logical input for menu flows. */
export async function keyboardActivate(page: Page, testId: string): Promise<void> {
  for (let i = 0; i < 40; i++) {
    if (await page.getByTestId(testId).evaluate(element => element === document.activeElement)) { await page.keyboard.press('Enter'); return; }
    await page.keyboard.press('Tab');
  }
  throw new Error(`Keyboard focus did not reach ${testId}`);
}
export async function menuStart(page: Page): Promise<void> {
  await page.goto(menuUrl);
  await expect(page.getByTestId('menu-title')).toBeVisible();
  await page.getByTestId('start-game').click(); await page.getByTestId('character-female').click(); await page.getByTestId('level-L1').click();
  await page.getByRole('button', { name: 'Begin mission' }).click();
  await expect(page.getByTestId('pause-button')).toBeVisible();
}
export async function hudStart(page: Page): Promise<void> {
  await page.goto(menuUrl); await page.waitForFunction(() => Boolean(window.__SS__));
  await page.evaluate(async () => {
    const api = window.__SS__!; await api.ready;
    await api.loadScenario('mission-sandbox'); api.pause(); api.missions.begin();
    api.setLoadout(['weapon.pistol', 'weapon.bat'], ['weapon.grenade', 'ability.ground-slam']);
    await api.step(1); api.camera.preset('hud-golden'); await api.screenshotReady();
  });
  await expect(page.getByTestId('hud')).toBeVisible();
}
