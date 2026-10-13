import { test, expect, boot } from '../fixtures';
import { preset } from '../../../src/sim/progression/Campaign';

test('T-E32-02-select @E32 @E32-AC02 Level select starts The Cure standalone with axe only', async ({ page }) => {
  test.setTimeout(180_000);
  await boot(page);
  const save = preset('L2-default');
  await page.evaluate(save => { window.__SS__!.campaign.restore(save); window.__SS__!.campaign.save(); window.__SS__!.campaign.menu(); }, save);
  await page.getByRole('button', { name: 'Level select', exact: true }).click();
  await page.getByRole('button', { name: 'Level 10 · The Cure (axe start)', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__SS__!.getState().scenario), { timeout: 120_000 }).toBe('L10');
  await page.evaluate(async () => { await window.__SS__!.screenshotReady(); window.__SS__!.pause(); });
  const state = await page.evaluate(() => window.__SS__!.getState());
  expect(state.player!.weapons!.LEFT.rack.map(s => s.id)).toEqual(['weapon.fire-axe']);
  expect(state.player!.weapons!.RIGHT.rack.map(s => s.id)).toEqual(['weapon.fire-axe']);
  expect(await page.evaluate(() => window.__SS__!.missions.state()!.checkpoint)).toBe('cure-crash');
  expect(state.entities.filter(e => e.vehicle)).toEqual([]);
  // Region geometry lands in D1–D4; reconstruct its reached prefix to isolate the save/reload wiring here.
  await page.evaluate(async () => { await window.__SS__!.loadLevel('L10', { checkpoint: 'cure-industrial' }); });
  expect(await page.evaluate(() => window.__SS__!.campaign.save())).toBe(true);
  const snapshot = await page.evaluate(() => window.__SS__!.campaign.state());
  expect(snapshot!.cureResume!.checkpoint.state.checkpoint).toBe('cure-industrial');
  await page.reload();
  await page.waitForFunction(() => !!window.__SS__);
  await page.evaluate(async () => { await window.__SS__!.ready; window.__SS__!.campaign.menu(); });
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__SS__!.getState().scenario), { timeout: 120_000 }).toBe('L10');
  await page.evaluate(async () => { await window.__SS__!.screenshotReady(); window.__SS__!.pause(); });
  expect(await page.evaluate(() => window.__SS__!.missions.state()!.checkpoint)).toBe('cure-industrial');
  const arsenal = await page.evaluate(() => window.__SS__!.getState().player!.weapons!.RIGHT.rack.map(slot => slot.id));
  expect(arsenal).toContain('weapon.pistol'); expect(arsenal).toContain('weapon.shotgun');
});
