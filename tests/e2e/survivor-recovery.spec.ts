import { boot, expect, test } from './fixtures';
import { mkdirSync, writeFileSync } from 'node:fs';

test('@E04 @E04-AC06 walking off finite ground recovers at the checkpoint', async ({ page }) => {
  await boot(page);
  await page.evaluate(async () => {
    const a = window.__SS__!; await a.loadScenario('interact-yard'); a.pause();
    a.setLoadout(['weapon.bat'], ['weapon.kick']);
    a.interact.giveItem('playtest-key');
  });
  // The yard has a finite floor and no perimeter wall, like campaign districts.
  await page.keyboard.down('d');
  await page.evaluate(() => window.__SS__!.step(780));
  await page.keyboard.up('d');
  await page.evaluate(() => window.__SS__!.step(180));
  const result = await page.evaluate(() => ({ state: window.__SS__!.getState(), events: window.__SS__!.events() }));
  mkdirSync('test-results/playtest', { recursive: true });
  writeFileSync(`test-results/playtest/fall-${process.env.FALL_BASELINE === '1' ? 'baseline' : 'fixed'}.json`, JSON.stringify(result, null, 2));
  expect(result.events.some(e => e.type === 'player.died')).toBe(true);
  expect(result.events.some(e => e.type === 'player.respawned')).toBe(true);
  expect(result.state.player!.transform.y).toBeGreaterThan(.65);
  expect(result.state.player!.survivor!.grounded).toBe(true);
  expect(Math.hypot(result.state.player!.transform.x, result.state.player!.transform.z)).toBeLessThan(.1);
  expect(result.state.player!.health.current).toBe(100);
  expect(result.state.player!.inventory).toContain('playtest-key');
  expect(result.state.player!.weapons!.LEFT.rack[0].id).toBe('weapon.bat');
  await page.evaluate(() => window.__SS__!.screenshotReady());
  await page.screenshot({ path: 'test-results/playtest/fall-recovered.png' });
});
