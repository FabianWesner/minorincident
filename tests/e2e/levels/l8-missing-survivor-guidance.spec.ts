import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect, boot } from '../fixtures';
import type { Game } from '../../../src/Game';

test('Q-141 @E30-AC13 physical APC boarding points to a missing survivor beyond the viewport', async ({ page }) => {
  test.setTimeout(180_000);
  await boot(page, '/?test=1&scenelab=1&renderer=webgl&dpr=1&quality=low&audio=muted&ui=1');
  await page.evaluate(async () => {
    const a = window.__SS__!; await a.loadLevel('L8', { seed: 1, progression: 'L8-default' }); a.pause(); a.missions.begin(); a.cheats.god(true);
    const game = (window.__SCENE__ as unknown as { game: Game }).game, w = game.world, zoo = w.missions!.l8!;
    zoo.advance(); a.cheats.killAll(); zoo.state.nextWave = w.tick + 100000;
    a.teleport(1, zoo.door());
    for (const id of zoo.passengers()) a.teleport(id, { x: 0, z: 0 });
  });
  await page.keyboard.down('KeyE'); await page.evaluate(() => window.__SS__!.step(1)); await page.keyboard.up('KeyE');
  await page.evaluate(() => window.__SS__!.step(3));
  await expect(page.getByTestId('objective-text')).toContainText('missing');
  await expect(page.getByTestId('minimap-cue')).toBeVisible();
  await expect(page.getByTestId('minimap-cue')).toHaveAttribute('data-survivor', /\d+/);
  await expect(page.getByTestId('sign-of-life')).toContainText('Find');
  const out = 'test-results/playtest/fixes-13l-gameplay'; mkdirSync(out, { recursive: true });
  await page.screenshot({ path: `${out}/Q-141-minimap.png` });
  const proof = await page.evaluate(() => ({ label: document.querySelector('[data-testid="sign-of-life"]')!.textContent, id: document.querySelector('[data-testid="minimap-cue"]')!.getAttribute('data-survivor'), player: window.__SS__!.getEntity(1)!.transform }));
  writeFileSync(`${out}/Q-141.json`, JSON.stringify(proof, null, 2));
});
