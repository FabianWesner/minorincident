import { test, expect, boot } from './fixtures';
import type { Game } from '../../src/Game';

test('T-E31-07-browser @E31-AC06 @E31-AC07 stopped hull attackers damage the APC; real driving ends attacks', async ({ page }) => {
  await boot(page, '/?test=1&scenelab=1&renderer=webgl&audio=muted&quality=high');
  await page.evaluate(async () => {
    await window.__SCENE__!.load({ seed: 31, ground: 'asphalt', size: 300, dof: false,
      actors: [{ id: 'courier', kind: 'courier', at: [.71, 2.025], yaw: 90 }],
      vehicles: [{ id: 'apc', asset: 'vehicle.military-apc', at: [0, 0] }], camera: { mode: 'game', target: 'apc' } });
  });
  await page.keyboard.down('KeyE'); await page.evaluate(() => window.__SS__!.step(1)); await page.keyboard.up('KeyE');
  await page.evaluate(() => window.__SS__!.step(75));
  const initial = await page.evaluate(() => {
    const w = (window.__SCENE__ as unknown as { game: Game }).game.world, car = [...w.vehicles!.cars.values()][0].entity;
    for (const [x, z] of [[1, 2.5], [-1, 2.5], [1, -2.5], [-1, -2.5]]) {
      const id = w.infected!.spawn('infected.runner', { x, z }, { state: 'chase' }), brain = w.entities.get(id)!.infected!;
      // Scene Lab installs the L1 civilian-search brain by default; this isolates the regular L9 brain.
      delete brain.l1; brain.state = 'chase'; brain.speed = 0;
    }
    const id = w.infected!.spawn('infected.runner', { x: 0, z: 0 });
    const down = w.entities.get(id)!; down.health.current = 0; down.infected!.state = 'dead'; down.infected!.recoverAt = w.tick + 10000;
    return car.health.current;
  });
  await page.evaluate(() => window.__SS__!.step(300));
  const stopped = await page.evaluate(() => {
    const w = (window.__SCENE__ as unknown as { game: Game }).game.world;
    return { hp: [...w.vehicles!.cars.values()][0].entity.health.current, hits: w.events.events().filter(e => e.type === 'vehicle.durability-hit') };
  });
  expect(stopped.hp).toBe(initial - 130);
  expect(stopped.hits.filter(e => e.type === 'vehicle.durability-hit' && e.source === 'contact')).toHaveLength(1);
  expect(stopped.hits.filter(e => e.type === 'vehicle.durability-hit' && e.source === 'attack')).toHaveLength(12);
  await page.keyboard.down('KeyW'); await page.evaluate(() => window.__SS__!.step(180));
  const departed = await page.evaluate(() => {
    const w = (window.__SCENE__ as unknown as { game: Game }).game.world;
    return [...w.vehicles!.cars.values()][0].entity;
  });
  expect(departed.transform.x).toBeGreaterThan(5);
  await page.evaluate(() => window.__SS__!.step(180)); await page.keyboard.up('KeyW');
  const finalHP = await page.evaluate(() => [...(window.__SCENE__ as unknown as { game: Game }).game.world.vehicles!.cars.values()][0].entity.health.current);
  expect(finalHP).toBe(departed.health.current);
});
