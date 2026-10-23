import { test, expect, boot } from '../fixtures';
import type { Game } from '../../../src/Game';

test('Q-141 @E30-AC13 boarding wait points to the nearest missing survivor on the minimap', async ({ page }) => {
  await boot(page, '/?test=1&renderer=webgl&dpr=1&quality=low&audio=muted&ui=1');
  await page.evaluate(async () => {
    const a = window.__SS__!; await a.loadLevel('L8', { seed: 1, progression: 'L8-default' }); a.pause();
    const game = (window.__SCENE__ as unknown as { game: Game }).game, w = game.world, zoo = w.missions!.l8!;
    zoo.advance();
    const id = zoo.roster()[0], e = w.entities.get(id)!;
    Object.assign(e.transform, { x: 150, z: 120 }); e.hidden = false; w.spatial.set(id, e.transform.x, e.transform.z);
    w.missions!.state.steps.depart.status = 'active';
    await a.step(1);
  });
  await expect(page.locator('[data-testid="objective-text"]')).toContainText('missing');
  await expect(page.locator('[data-testid="cue"]')).toBeVisible();
  await expect(page.locator('[data-testid="cue"]')).toHaveAttribute('data-survivor', /\d+/);
  await expect(page.locator('[data-testid="sign-of-life"]')).toContainText('Find');
});
