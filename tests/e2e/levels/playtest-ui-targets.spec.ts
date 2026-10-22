import { look } from '../../../tools/playtest/eyes';
import { test, expect, boot } from '../fixtures';

test('Q-123 playtest combat cannot click Home through a rendered infected while movement is held', async ({ page }) => {
  test.setTimeout(180_000);
  await page.addInitScript('window.__name = f => f');
  await boot(page, '/?test=1&ui=1&renderer=webgl&dpr=1&audio=muted&quality=low');
  await page.evaluate(async () => {
    const a = window.__SS__!;
    await a.loadLevel('L7', { seed: 1, progression: 'L7-default' });
    a.pause(); a.debug.figureJoints(true);
    const p = a.getEntity(1)!.transform;
    a.spawn('infected.runner', { x: p.x - 3, z: p.z + 1 });
    await a.step(1); await a.screenshotReady();
  });
  const target = (await page.evaluate(look)).enemies[0];
  expect(target, 'the fixture has a drawn target').toBeDefined();
  // A camera/actor combination can put an enemy behind any HUD control. Move
  // the real Home button over its submitted chest to make that overlap stable.
  await page.getByTestId('home-button').evaluate((button, point) => {
    const bounds = button.getBoundingClientRect();
    Object.assign(button.style, { position: 'fixed', left: `${point.x - bounds.width / 2}px`, top: `${point.y - bounds.height / 2}px`, zIndex: '99999' });
  }, target.aim);
  await page.evaluate(() => window.__SS__!.resume());
  await page.keyboard.down('a'); await page.keyboard.down('w');
  const observed = await page.evaluate(look);
  const chosen = observed.enemies[0];
  if (chosen) { await page.mouse.move(chosen.aim.x, chosen.aim.y); await page.mouse.down(); await page.mouse.up(); }
  await expect(page.getByTestId('menu-title')).toBeHidden();
  expect(observed.enemies.some(enemy => enemy.id === target.id), 'covered bodies must not become mouse targets').toBe(false);
  const tick = await page.evaluate(() => window.__SS__!.tick());
  await expect.poll(() => page.evaluate(() => window.__SS__!.tick())).toBeGreaterThan(tick);
  await page.keyboard.up('w'); await page.keyboard.up('a');
  await page.screenshot({ path: 'test-results/playtest/fixes-13j-q123/protected-home.png' });
});
