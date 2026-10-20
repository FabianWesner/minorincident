import { test, expect } from '../fixtures';

/**
 * P0 10-20 (PO, PROD): "L7 starts hanging" - debug panel: L7, step rocket, Sim tick 0, 60 FPS. The window lost focus while L7
 * loaded: AudioService paused the clock, the pause menu could not open over the loading card, and L7 has no briefing whose
 * "Begin mission" would resume it. The sim must never sit paused without a visible Resume. PROD mode (no test=1), real clock.
 */
test.use({ trace: 'off', ...(process.platform === 'darwin' ? { launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] } } : {}) });

test('@E29 P0 focus lost while L7 loads: the pause menu shows and Resume starts the level', async ({ page }) => {
  test.setTimeout(240_000); page.setDefaultTimeout(120_000);
  await page.goto('/?test=1&renderer=webgl&dpr=1&audio=muted&seed=1');
  await page.waitForFunction(() => Boolean(window.__SS__)); await page.evaluate(() => window.__SS__!.ready);
  await page.evaluate(() => window.__SS__!.loadLevel('L6', { seed: 1, progression: 'L7-default' }));
  await page.evaluate(() => window.__SS__!.campaign.save());
  await page.goto('/?testApi=1&renderer=webgl&dpr=1&quality=low&audio=muted');
  await page.waitForFunction(() => Boolean(window.__SS__)); await page.evaluate(() => window.__SS__!.ready);
  await page.getByTestId('start-game').click(); await page.getByTestId('level-L7').click();
  await page.waitForTimeout(300);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.waitForFunction(() => window.__SS__!.getState().scenario === 'L7' && !document.querySelector('[data-testid=level-transition]:not([hidden])'), null, { timeout: 120_000 });
  await page.waitForTimeout(3000);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  const resume = page.getByTestId('resume-game');
  await expect(resume, 'a paused L7 offers Resume').toBeVisible({ timeout: 10_000 });
  const before = await page.evaluate(() => window.__SS__!.getState().tick);
  await resume.click();
  await page.waitForTimeout(2000);
  const after = await page.evaluate(() => window.__SS__!.getState().tick);
  expect(after - before, 'L7 runs after Resume').toBeGreaterThan(60);
});
