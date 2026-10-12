import { test, expect, boot } from './fixtures';
import type { Game } from '../../src/Game';
test('T-E30-14-browser @E30-AC14 real APC enter, drive, both firing inputs and exit', async ({ page }) => {
  await boot(page, '/?test=1&scenelab=1&renderer=webgl&audio=muted&quality=high');
  await page.evaluate(async () => {
    await window.__SCENE__!.load({ ground: 'asphalt', size: 100, dof: false,
      actors: [{ id: 'courier', kind: 'courier', at: [.71, 2.025], yaw: 90 }],
      vehicles: [{ id: 'apc', asset: 'vehicle.military-apc', at: [0, 0] }], camera: { mode: 'game', target: [0, .7, 0] } });
  });
  await page.keyboard.down('KeyE'); await page.evaluate(() => window.__SS__!.step(1)); await page.keyboard.up('KeyE');
  await page.evaluate(() => window.__SS__!.step(75)); await page.evaluate(() => window.__SS__!.screenshotReady());
  const seated = await page.evaluate(() => window.__SS__!.getState());
  expect(seated.player!.hidden).toBe(true);
  expect(seated.render.vehicles.some(v => 'occupants' in v && v.occupants.some(o => o.actorId === 1))).toBe(true);
  await page.keyboard.down('KeyW'); await page.mouse.down({ button: 'left' }); await page.mouse.down({ button: 'right' });
  await page.evaluate(() => window.__SS__!.step(180));
  await page.keyboard.up('KeyW'); await page.mouse.up({ button: 'left' }); await page.mouse.up({ button: 'right' });
  const driven = await page.evaluate(() => {
    const game = (window.__SCENE__ as unknown as { game: Game }).game;
    return { car: [...game.world.vehicles!.cars.values()][0].entity, attacks: game.world.events.events().filter(e => e.type === 'combat.attack') };
  });
  expect(driven.car.transform.x).toBeGreaterThan(5); expect(driven.attacks).toHaveLength(0);
  await page.keyboard.down('KeyE'); await page.evaluate(() => window.__SS__!.step(1)); await page.keyboard.up('KeyE');
  await page.evaluate(() => window.__SS__!.step(75));
  expect((await page.evaluate(() => window.__SS__!.getState())).player!.hidden).toBe(false);
});
