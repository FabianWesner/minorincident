import type { Game } from '../../src/Game';
import { boot, expect, test } from './fixtures';
import { tick } from './input-helpers';

test('@E03 @E13 Q-161 held mouse fire survives real WASD with the carried RIGHT MG', async ({ page }) => {
  await boot(page, '/?test=1&testApi=1&scenelab=1&renderer=webgl&quality=low&audio=muted');
  const id = await page.evaluate(async () => {
    const a = window.__SS__!; await a.loadScenario('horde-arena'); a.pause();
    a.setLoadout(['weapon.fire-axe'], ['weapon.army-mg']); a.cheats.god(true);
    const id = a.spawn('infected.runner', { x: 6, z: 0 });
    const w = (window.__SCENE__ as unknown as { game: Game }).game.world, enemy = w.entities.get(id)!;
    enemy.health.current = enemy.health.max = 10000; enemy.infected!.until = Number.MAX_SAFE_INTEGER; enemy.combat!.staggerUntil = Number.MAX_SAFE_INTEGER;
    return id;
  });
  await page.keyboard.press('5'); await tick(page, 20);
  const point = await page.evaluate(id => window.__SS__!.input.project(window.__SS__!.getEntity(id)!.transform, 'player'), id);
  await page.mouse.move(point.x, point.y - 12); await page.mouse.down(); await tick(page, 12);
  await page.keyboard.down('w'); await tick(page, 75); await page.keyboard.up('w');
  await tick(page, 30); await page.mouse.up(); await tick(page, 15);
  const result = await page.evaluate(id => ({ hp: window.__SS__!.getEntity(id)!.health.current,
    shots: window.__SS__!.events().filter(e => e.type === 'combat.attack' && e.sourceId === 1 && e.actionId === 'weapon.army-mg').length }), id);
  expect(result.shots).toBeGreaterThanOrEqual(15); expect(result.hp).toBeLessThan(9900);
});

test('@E05 Q-161 empty trigger displays the empty cue, emits the dry click and selects a usable fallback', async ({ page }) => {
  await boot(page, '/?test=1&ui=1&testApi=1&scenelab=1&renderer=webgl&quality=low');
  await page.evaluate(async () => {
    const a = window.__SS__!; await a.loadScenario('mission-sandbox'); a.pause(); a.missions.begin();
    a.setLoadout(['weapon.fire-axe'], ['weapon.pistol', 'weapon.handgun']);
    const g = (window.__SCENE__ as unknown as { game: Game }).game;
    g.world.combat!.runner.loadout.state.RIGHT.rack[0].magazine = 0;
    g.world.combat!.runner.loadout.state.selectedSide = 'RIGHT';
  });
  await tick(page, 1); await expect(page.getByTestId('weapon-active')).toHaveAttribute('data-state', 'empty');
  await page.keyboard.press('Space'); await tick(page, 2);
  await expect(page.getByTestId('weapon-active')).toHaveAttribute('data-weapon', 'weapon.handgun');
  await expect(page.getByTestId('weapon-active')).toContainText('Empty');
  const dry = await page.evaluate(() => window.__SS__!.events().filter(e => e.type === 'combat.empty'));
  expect(dry).toHaveLength(1);
  await page.screenshot({ path: 'docs/reports/carryover-ammo/empty-hud.png' });
});
