import { mkdirSync } from 'node:fs';
import { expect, test } from './fixtures';
import { menuStart } from './ui-helpers';

/** Continue reloads the level from the save; if it re-opens the briefing, accept it like a player would. */
async function resumeAfterContinue(page: import('@playwright/test').Page): Promise<void> {
  await expect(page.getByTestId('menu-title')).toBeHidden({ timeout: 120_000 });
  const begin = page.getByTestId('mission-button');
  await expect(begin.or(page.getByTestId('pause-button')).first()).toBeVisible({ timeout: 120_000 });
  if (await begin.isVisible()) { await begin.click(); }
  await expect(page.getByTestId('pause-button')).toBeVisible({ timeout: 120_000 });
}

/** PO 10-12: "Add a home button that brings me to initial menu". */
test.describe('HUD Home button @ui-home', () => {
  test('HUD Home returns to the initial menu, Continue restores the level, no attack input, focus order intact', async ({ page }, info) => {
    test.setTimeout(240_000);
    await menuStart(page);
    const home = page.getByTestId('home-button');
    await expect(home).toBeVisible();
    await expect(home).toHaveAccessibleName('Home');
    const box = (await home.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44);
    // Fully inside the viewport and clear of the other HUD blocks.
    const vp = page.viewportSize()!;
    expect(box.x).toBeGreaterThanOrEqual(0); expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(vp.width); expect(box.y + box.height).toBeLessThanOrEqual(vp.height);
    const overlaps = await page.evaluate(() => {
      const h = document.querySelector('[data-testid=home-button]')!.getBoundingClientRect();
      return ['minimap', 'objective-tracker', 'pause-button', 'touch-controls', 'hud-vitals', 'vitals'].flatMap(id => {
        const el = document.querySelector<HTMLElement>(`[data-testid=${id}]`); if (!el || !el.getClientRects().length) return [];
        const r = el.getBoundingClientRect();
        return h.left < r.right && h.right > r.left && h.top < r.bottom && h.bottom > r.top ? [id] : [];
      });
    });
    expect(overlaps).toEqual([]);
    mkdirSync('docs/reports/ui-home-button', { recursive: true });
    await page.screenshot({ path: `docs/reports/ui-home-button/after-hud-${info.project.name}.png` });
    // Keyboard: Home takes focus like any button, Escape still toggles the pause bar (Home hides while paused).
    await home.focus(); await expect(home).toBeFocused();
    await page.keyboard.press('Escape'); await expect(page.getByTestId('menu-pause')).toBeVisible();
    await expect(home).toBeHidden();
    await page.keyboard.press('Escape'); await expect(page.getByTestId('menu-pause')).toBeHidden();
    await expect(home).toBeVisible();
    // Clicking Home must not reach the canvas input (Pointer listens for mousedown on the canvas element).
    await page.evaluate(() => {
      const w = window as unknown as { __canvasDown: number };
      w.__canvasDown = 0; document.querySelector('canvas')!.addEventListener('mousedown', () => { w.__canvasDown++; });
      document.querySelector('canvas')!.addEventListener('pointerdown', () => { w.__canvasDown++; });
    });
    await home.click();
    await expect(page.getByTestId('menu-title')).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __canvasDown: number }).__canvasDown)).toBe(0);
    await expect(page.getByTestId('continue-game')).toBeVisible();
    await expect(home).toBeHidden();
    await page.getByTestId('continue-game').click();
    await resumeAfterContinue(page);
    await expect(home).toBeVisible();
  });

  test('pause menu "Home" lands on the same initial menu and Continue works', async ({ page }) => {
    test.setTimeout(240_000);
    await menuStart(page);
    await page.getByTestId('pause-button').click();
    const item = page.getByTestId('pause-title');
    await expect(item).toHaveText(/Home/);
    await item.click();
    await expect(page.getByTestId('menu-title')).toBeVisible();
    await expect(page.getByTestId('start-game')).toBeVisible();
    await page.getByTestId('continue-game').click();
    await resumeAfterContinue(page);
    await expect(page.getByTestId('home-button')).toBeVisible();
  });

  test('Home is hidden while the UI is hidden (H)', async ({ page }) => {
    test.skip(test.info().project.name !== 'chromium', 'keyboard H is a desktop flow');
    test.setTimeout(240_000);
    await menuStart(page);
    await page.keyboard.press('Escape'); await page.keyboard.press('KeyH');
    await expect(page.getByTestId('home-button')).toBeHidden();
  });
});
