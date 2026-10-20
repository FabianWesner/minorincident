import { test, expect } from './fixtures';

/** PO #76 (10-20): "When in debug mode, show all levels (locked), but still let me click them to play". */
for (const debug of [true, false]) test(`@E14 locked L8 from a fresh save ${debug ? 'starts with ?debug=1' : 'stays locked without debug'}`, async ({ page }) => {
  test.setTimeout(240_000); page.setDefaultTimeout(120_000);
  // An early save (L2 unlocked), written by the harness; the menu flow below is real input.
  await page.goto('/?test=1&renderer=webgl&dpr=1&audio=muted&seed=1');
  await page.waitForFunction(() => Boolean(window.__SS__)); await page.evaluate(() => window.__SS__!.ready);
  await page.evaluate(async () => { const a = window.__SS__!; await a.loadLevel('L2', { seed: 1, progression: 'L2-default' }); a.campaign.save(); });
  await page.goto(`/?testApi=1&renderer=webgl&dpr=1&quality=low&audio=muted${debug ? '&debug=1' : ''}`);
  await page.waitForFunction(() => Boolean(window.__SS__)); await page.evaluate(() => window.__SS__!.ready);
  await page.getByTestId('start-game').click();
  const l8 = page.getByTestId('level-L8');
  await expect(l8).toHaveAttribute('aria-disabled', 'true');
  await l8.click({ force: true }); // aria-disabled: Playwright treats it as not enabled; a real click still lands
  if (debug) {
    await page.waitForFunction(() => window.__SS__!.getState().scenario === 'L8', null, { timeout: 180_000 });
    await expect(page.getByText(/Could not load/)).toHaveCount(0);
  } else {
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => window.__SS__!.getState().scenario)).not.toBe('L8');
    await expect(page.getByText('Complete Level 7 first')).toBeVisible();
  }
});
