import { test, expect, boot } from '../fixtures';
import type { Game } from '../../../src/Game';

test('Q-123 L6 to L7 handover stays playable for 90 seconds with A and W held across the transition', async ({ page }) => {
  test.setTimeout(600_000);
  page.setDefaultTimeout(60_000);
  await boot(page, '/?test=poses&testApi=1&scenelab=1&renderer=webgl&dpr=1&audio=muted&quality=low');
  page.on('console', message => { if (message.text().startsWith('handover-flow ')) console.log(message.text()); });
  await page.evaluate(() => {
    const g = (window.__SCENE__ as unknown as { game: Game }).game;
    const pause = g.clock.pause.bind(g.clock), show = g.ui.show.bind(g.ui);
    g.clock.pause = () => { console.log('handover-flow ' + JSON.stringify({ operation: 'pause', tick: g.world.tick, level: g.world.scenario, stack: new Error().stack })); pause(); };
    g.ui.show = (...args) => { console.log('handover-flow ' + JSON.stringify({ operation: 'menu', args, tick: g.world.tick, level: g.world.scenario, stack: new Error().stack })); show(...args); };
  });

  for (let attempt = 0; attempt < 3; attempt++) {
    await page.evaluate(async seed => {
      const a = window.__SS__!;
      await a.loadLevel('L6', { seed, progression: 'L6-default' });
      const save = a.campaign.state()!;
      save.racks = { LEFT: ['weapon.fists'], RIGHT: ['weapon.kick'] };
      a.campaign.restore(save);
      await a.loadLevel('L6', { seed });
    }, 410 + attempt);
    await page.getByTestId('mission-button').click();
    await page.evaluate(async () => {
      const a = window.__SS__!;
      a.pause();
      for (let i = 0; i < 30 && a.missions.state()!.phase !== 'result'; i++) {
        if (a.missions.state()!.phase === 'playing') {
          try { a.cheats.completeObjective(); } catch { /* Scripted gaps advance on the simulation clock. */ }
        }
        await a.step(120);
      }
    });
    await expect.poll(() => page.evaluate(() => window.__SS__!.missions.state()!.phase)).toBe('result');

    await page.keyboard.down('a');
    await page.keyboard.down('w');
    await page.getByTestId('mission-button').click();
    await page.waitForFunction(() => window.__SS__!.getState().scenario === 'L7' && window.__SS__!.missions.state()?.phase === 'playing' && document.querySelector<HTMLElement>('[data-testid="level-transition"]')?.hidden, undefined, { timeout: 60_000 });
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
