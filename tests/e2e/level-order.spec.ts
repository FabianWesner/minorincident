import {boot,expect,test,testUrl} from './fixtures';
import {preset,newCampaign} from '../../src/sim/progression/Campaign';
import {SAVE_KEY} from '../../src/sim/progression/Save';
// PO bug 2026-10-12: after finishing L1 the game loaded L3. Finishing level N must always continue with N+1.
for (const [name, make] of [['fresh save', () => newCampaign('female')], ['save with L2 completed (replaying L1)', () => preset('L3-default')]] as const) {
  test(`@level-order finishing L1 loads L2 (${name})`, async ({ page }) => {
    test.setTimeout(180_000);
    await boot(page, `${testUrl}&ui=1`);
    await page.evaluate(([key, save]) => localStorage.setItem(key, JSON.stringify(save)), [SAVE_KEY, make()] as const);
    await page.reload(); await page.waitForFunction(() => !!window.__SS__); await page.evaluate(() => window.__SS__!.ready);
    await page.getByTestId('start-game').click();
    if (await page.getByTestId('character-female').isVisible().catch(() => false)) await page.getByTestId('character-female').click();
    await page.getByTestId('level-L1').click();
    await expect(page.getByRole('button', { name: 'Begin mission', exact: true })).toBeVisible({ timeout: 60_000 });
    await page.getByRole('button', { name: 'Begin mission', exact: true }).click();
    await page.evaluate(async () => {
      const a = window.__SS__!; a.pause();
      for (let i = 0; i < 100 && a.missions.state()!.phase !== 'result'; i++) {
        if (a.missions.state()!.phase === 'cinematic') await a.step(600); else { a.cheats.completeObjective(); await a.step(1); }
      }
    });
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Mission briefing' })).toBeVisible({ timeout: 60_000 });
    expect(await page.evaluate(() => window.__SS__!.getState().scenario)).toBe('L2');
  });
}
