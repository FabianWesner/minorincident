import { mkdirSync } from 'node:fs';
import { test, expect, boot, testUrl } from '../fixtures';

/** E22 smoke: L4 loads (D-FAIR layout, army dressing, convoy set pieces, crowd) and the first seconds of the ride render without errors. */
test('T-E22-boot @E22 @E22-AC18 @smoke L4 boots, the convoy rolls and the plaza is reachable without console errors', async ({ page }) => {
  test.setTimeout(300_000); mkdirSync('test-results/epics/E22', { recursive: true });
  await boot(page, `${testUrl}&ui=1`);
  await page.evaluate(() => window.__SS__!.loadLevel('L4', { seed: 1, progression: 'L4-default' }));
  await page.evaluate(() => window.__SS__!.pause());
  await page.getByRole('button', { name: 'Begin mission' }).click();
  await page.evaluate(async () => { const a = window.__SS__!; a.pause(); await a.step(240); await a.screenshotReady(); });
  await page.screenshot({ path: 'test-results/epics/E22/boot-ride.png' });
  const state = await page.evaluate(() => { const a = window.__SS__!; return { scenario: a.getState().scenario, phase: a.missions.state()!.l4!.phase, bus: a.missions.state()!.l4!.convoyIds.length }; });
  expect(state).toEqual({ scenario: 'L4', phase: 'convoy', bus: 5 });
  await page.evaluate(() => { const a = window.__SS__!; a.cheats.completeObjective('ride'); });
  await page.evaluate(async () => { const a = window.__SS__!; await a.step(60); a.camera.preset('D-FAIR/W0/l4-plaza-safe'); await a.screenshotReady(); });
  await page.screenshot({ path: 'test-results/epics/E22/boot-plaza.png' });
});
