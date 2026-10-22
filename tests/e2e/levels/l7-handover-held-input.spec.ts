import { test, expect, boot, testUrl } from '../fixtures';

test('Q-123 L6 to L7 handover stays playable for 90 seconds with A and W held across the transition', async ({ page }) => {
  test.setTimeout(600_000);
  page.setDefaultTimeout(60_000);
  await boot(page, `${testUrl}&ui=1`);

  for (let attempt = 0; attempt < 3; attempt++) {
    await page.evaluate(async seed => {
      const a = window.__SS__!;
      await a.loadLevel('L6', { seed, progression: 'L6-default' });
    }, 410 + attempt);
    await page.getByTestId('mission-button').click();
    for (let i = 0; i < 30; i++) {
      const phase = await page.evaluate(() => window.__SS__!.missions.state()!.phase);
      if (phase === 'result') break;
      if (phase === 'playing') await page.evaluate(() => window.__SS__!.cheats.completeObjective());
      else await page.evaluate(() => window.__SS__!.step(120));
    }
    await expect.poll(() => page.evaluate(() => window.__SS__!.missions.state()!.phase)).toBe('result');

    await page.keyboard.down('a');
    await page.keyboard.down('w');
    await page.getByTestId('mission-button').click();
    await page.waitForFunction(() => window.__SS__!.getState().scenario === 'L7' && window.__SS__!.missions.state()?.phase === 'playing', undefined, { timeout: 60_000 });
    let priorTick = await page.evaluate(() => window.__SS__!.tick());
    for (let second = 0; second < 90; second += 5) {
      await page.waitForTimeout(5_000);
      const observation = await page.evaluate(() => ({
        scenario: window.__SS__!.getState().scenario,
        phase: window.__SS__!.missions.state()?.phase,
        tick: window.__SS__!.tick(),
        titleVisible: document.querySelector<HTMLElement>('[data-testid="menu-title"]')?.hidden === false,
        campaignMenuVisible: !document.querySelector<HTMLElement>('.campaign-ui')?.hidden,
      }));
      expect(observation.scenario, `handover ${attempt + 1}, ${second + 5}s`).toBe('L7');
      expect(observation.phase, `handover ${attempt + 1}, ${second + 5}s`).toBe('playing');
      expect(observation.tick, `simulation clock stalled at ${priorTick}`).toBeGreaterThan(priorTick);
      expect(observation.titleVisible).toBe(false);
      expect(observation.campaignMenuVisible).toBe(false);
      priorTick = observation.tick;
    }
    await page.keyboard.up('w');
    await page.keyboard.up('a');
  }
});
