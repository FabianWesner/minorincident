import { test, expect, boot } from '../fixtures';

for (const quality of ['high', 'low']) test(`T-E32-16-E2 @E32-AC15 @E32-AC16 @E32-AC29 @E32-AC27 ${quality} real terminal input and unique backpack retry`, async ({ page }) => {
  test.setTimeout(180_000);
  await boot(page, `/?test=1&renderer=webgl&quality=${quality}&audio=muted&seed=32`);
  await page.evaluate(async quality => { window.__SS__!.settings.set({ quality: quality as 'high' | 'low' }); await window.__SS__!.loadLevel('L10', { seed: 32, checkpoint: 'cure-research-entry', progression: 'L10-default' }); window.__SS__!.pause(); }, quality);
  const go = async (x: number, z: number) => {
    await page.evaluate(async at => { window.__SS__!.teleport('player', at); window.__SS__!.camera.follow(); await window.__SS__!.screenshotReady(); }, { x, z });
  };
  const interact = async () => {
    await page.keyboard.down('KeyE'); await page.evaluate(async () => { await window.__SS__!.step(1); }); await page.keyboard.up('KeyE');
  };
  await go(2707, 41); await interact();
  expect(await page.evaluate(() => window.__SS__!.missions.state()!.states['terminal-read'])).toBe(true);
  expect(await page.evaluate(() => window.__SS__!.missions.state()!.subtitle?.id)).toBe('L10.research');
  await expect(page.getByTestId('mission-subtitle')).toBeVisible();
  await expect(page.getByTestId('mission-subtitle')).toContainText('harmless to healthy');
  await go(2713, 41); await interact();
  expect(await page.evaluate(() => window.__SS__!.missions.state()!.items)).toEqual(['cure-canister']);
  expect(await page.evaluate(() => window.__SS__!.getState().render.character!.cureVisible)).toBe(true);
  await go(2807, 45); await page.evaluate(async () => { await window.__SS__!.step(1); });
  expect(await page.evaluate(() => window.__SS__!.missions.state()!.checkpoint)).toBe('cure-research');
  await go(2937, -5); await interact();
  expect(await page.evaluate(() => window.__SS__!.campaign.state()!.ownedActions)).toContain('weapon.rocket-launcher');
  await page.evaluate(async () => { await window.__SS__!.step(180); window.__SS__!.survivor.damage(1000); });
  expect(await page.evaluate(() => window.__SS__!.getState().player!.health.current)).toBe(0);
  await page.evaluate(async () => { await window.__SS__!.step(400); });
  expect(await page.evaluate(() => window.__SS__!.missions.state()!.checkpoint)).toBe('cure-corridor');
  expect(await page.evaluate(() => window.__SS__!.missions.state()!.items)).toEqual(['cure-canister']);
  expect(await page.evaluate(() => window.__SS__!.getState().render.character!.cureVisible)).toBe(true);
  await go(2713, 41); await interact();
  expect(await page.evaluate(() => window.__SS__!.missions.state()!.items)).toEqual(['cure-canister']);
  expect(await page.evaluate(() => window.__SS__!.campaign.save())).toBe(true);
  await page.reload(); await page.waitForFunction(() => !!window.__SS__);
  await page.evaluate(async () => { await window.__SS__!.ready; window.__SS__!.campaign.menu(); });
  await page.getByTestId('start-game').click();
  await expect(page.getByTestId('level-resume-L10')).toBeVisible();
  await page.getByTestId('level-L10').click();
  await expect.poll(() => page.evaluate(() => window.__SS__!.getState().scenario), { timeout: 120_000 }).toBe('L10');
  await page.evaluate(async () => { await window.__SS__!.screenshotReady(); window.__SS__!.pause(); });
  expect(await page.evaluate(() => window.__SS__!.missions.state()!.items)).toEqual(['cure-canister']);
  expect(await page.evaluate(() => window.__SS__!.getState().render.character!.cureVisible)).toBe(true);
  expect(await page.evaluate(() => window.__SS__!.getState().render.quality)).toBe(quality);
  expect(await page.evaluate(() => window.__SS__!.campaign.state()!.ownedActions)).toContain('weapon.rocket-launcher');
});
