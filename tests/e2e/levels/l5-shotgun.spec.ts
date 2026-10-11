import { mkdirSync } from 'node:fs';
import { test, expect } from '../fixtures';

test('T-E23-12-browser @E23 @E23-AC12 basement pickup and no ammunition HUD', async ({ page }) => {
  test.setTimeout(180_000);
  const dir = 'test-results/epics/E23/l5-shotgun-after'; mkdirSync(dir, { recursive: true });
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/?test=1&renderer=webgl&audio=muted');
  await page.waitForFunction(() => Boolean(window.__SS__));
  await page.evaluate(async () => { const a = window.__SS__!; await a.ready; await a.loadLevel('L5', { seed: 1, progression: 'L5-default' }); a.pause(); a.missions.begin(); a.camera.follow(); await a.screenshotReady(); });
  await page.locator('canvas').screenshot({ path: `${dir}/before-pickup.png` });
  await page.keyboard.press('e');
  await page.evaluate(async () => { const a = window.__SS__!; await a.step(36); await a.screenshotReady(); });
  const state = await page.evaluate(() => { const a = window.__SS__!, s = a.getState(), w = s.player!.weapons!; return { ids: [...w.LEFT.rack, ...w.RIGHT.rack].map(r => r.id), active: w.RIGHT.rack[w.RIGHT.index], pickups: s.entities.filter(e => e.pickup && 'actionId' in e.pickup).length }; });
  expect(state.ids).toEqual(expect.arrayContaining(['weapon.bat', 'weapon.fire-axe', 'weapon.handgun', 'weapon.army-mg', 'weapon.shotgun']));
  expect(state.active).toMatchObject({ id: 'weapon.shotgun', magazine: 0, reloadUntil: 0 }); expect(state.pickups).toBe(0);
  await page.locator('canvas').screenshot({ path: `${dir}/after-pickup.png` });
  const hud = await page.locator('[data-ammo]').allTextContents(); expect(hud.some(t => /\d+\s*\/\s*\d+/.test(t))).toBe(false);
  expect(errors).toEqual([]);
});
