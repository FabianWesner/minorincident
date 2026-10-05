import { boot, expect, test } from './fixtures';

test('S-01 @smoke foundation boots, ready resolves and a screenshot is available', async ({ page }, testInfo) => {
  await boot(page);
  await page.evaluate(async () => { await window.__SS__!.step(60); await window.__SS__!.screenshotReady(); });
  await expect(page).toHaveTitle('Minor Incident');
  await expect(page.locator('canvas')).toBeVisible();
  expect(await page.evaluate(() => window.__SS__!.getState().perf)).toMatchObject({ entities: 1, bodies: 2 });
  await page.screenshot({ path: `test-results/epics/E01/empty-${testInfo.project.name}.png` });
});

test('S-10-foundation @smoke empty scenario reload x3 leaves no entities or bodies', async ({ page }) => {
  await boot(page);
  const resources = await page.evaluate(async () => {
    const api = window.__SS__!;
    for (let i = 0; i < 3; i++) { await api.loadScenario('empty'); api.pause(); await api.step(60); await api.unloadScenario(); }
    return api.getState().perf;
  });
  expect(resources).toEqual({ entities: 0, bodies: 0, colliders: 0, listeners: 0 });
});
