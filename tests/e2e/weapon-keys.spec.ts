import type { Game } from '../../src/Game';
import { mkdirSync, writeFileSync } from 'node:fs';
import { boot, expect, test } from './fixtures';
import { tick } from './input-helpers';
import { menuUrl } from './ui-helpers';

test('@E03 fixed weapon keys in L2 select bat/axe across racks and display every carried shortcut', async ({ page, context }) => {
  test.setTimeout(180_000);
  await boot(page, `${menuUrl}&scenelab=1`);
  await page.evaluate(async () => {
    const a = window.__SS__!; await a.loadLevel('L2'); a.pause(); a.missions.begin(); a.cheats.god(true);
    a.setLoadout(['weapon.bat', 'weapon.fists'], ['weapon.fire-axe', 'weapon.handgun', 'weapon.army-mg']);
    // Retained campaign pickups can exceed the constructor's three-slot capacity.
    for (const id of ['weapon.shotgun', 'weapon.rocket-launcher', 'weapon.molotov', 'weapon.pipe-bomb']) (window.__SCENE__ as unknown as { game: Game }).game.world.combat!.pickups.spawn(id, a.getState().player!.transform, false, { retain: true });
    await a.step(2); await a.screenshotReady();
  });
  const active = () => page.evaluate(() => { const w = window.__SS__!.getState().player!.weapons!; return w[w.selectedSide].rack[w[w.selectedSide].index].id; });
  await expect(page.getByTestId('hud')).toBeVisible();
  // No pointer activity: keyboard-only uses the same fixed keys.
  for (const [key, id] of [['3', 'weapon.fire-axe'], ['2', 'weapon.bat']] as const) {
    await page.keyboard.press(key); await tick(page, 20); expect(await active()).toBe(id);
    await expect(page.getByTestId('weapon-active')).toHaveAttribute('data-weapon', id);
    await expect.poll(() => page.evaluate(async () => {
      const a = window.__SS__!; await a.step(1);
      return a.getState().render.actions!.attachments.filter(item => item.visible).map(item => item.actionId);
    })).toEqual([id]);
  }
  await page.mouse.move(800, 450);
  for (const [key, id] of [['3', 'weapon.fire-axe'], ['2', 'weapon.bat'], ['9', 'weapon.pipe-bomb'], ['7', 'weapon.rocket-launcher'], ['8', 'weapon.molotov'], ['6', 'weapon.shotgun'], ['5', 'weapon.army-mg'], ['4', 'weapon.handgun'], ['1', 'weapon.fists']] as const) {
    await page.keyboard.press(key); await tick(page, 20); expect(await active()).toBe(id);
    await expect(page.getByTestId(`weapon-key-${key}`)).toHaveText(key);
    await expect(page.locator(`.hud-weapon-choice[data-weapon="${id}"]`)).toHaveAttribute('data-selected', 'true');
  }
  await expect(page.locator('[data-input-hint]')).toContainText('1–9');
  await page.keyboard.press('Shift+2'); await tick(page, 20); expect(await active()).toBe('weapon.handgun');
  // Render quality and exact camera ratios vary; DOM shortcut badges retain their screen size.
  const out = 'docs/reports/weapon-keys'; mkdirSync(out, { recursive: true });
  const captures: { quality: string; zoom: number; actual: number }[] = [];
  await page.keyboard.press('3'); await tick(page, 20);
  for (const quality of ['high', 'low'] as const) {
    await page.evaluate(q => window.__SS__!.settings.set({ quality: q }), quality);
    for (const zoom of [.5, 1, 1.5]) {
      await page.evaluate(async ratio => {
        const a = window.__SS__!, game = (window.__SCENE__ as unknown as { game: Game }).game;
        game.view.view.zoom(Math.log(ratio / a.getState().render.camera.targetZoom), true);
        await a.step(1); await a.screenshotReady();
      }, zoom);
      const actual = await page.evaluate(() => window.__SS__!.getState().render.camera.zoom);
      expect(actual).toBeCloseTo(zoom, 6); captures.push({ quality, zoom, actual });
      await page.screenshot({ path: `${out}/hud-${quality}-zoom-${zoom}.png` });
    }
  }
  writeFileSync(`${out}/captures.json`, JSON.stringify(captures, null, 2) + '\n');
  // Touch switches hide keyboard badges without replacing the carried loadout.
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 600, y: 700, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await tick(page, 1); await expect(page.getByTestId('weapon-rack')).toBeHidden();
  // A missing numbered weapon does nothing, even when another action occupies its old ordinal position.
  await page.evaluate(() => window.__SS__!.setLoadout(['weapon.bat'], ['weapon.crowbar']));
  await page.keyboard.press('3'); await tick(page, 20); expect(await active()).toBe('weapon.bat');
});

test('@E03 weapon numbers are inert while driving or manning a mounted gun', async ({ page }) => {
  await boot(page, `${menuUrl}&scenelab=1`);
  await page.evaluate(async () => {
    const a = window.__SS__!; await a.loadScenario('combat-arena'); a.pause(); a.setLoadout(['weapon.bat'], ['weapon.fire-axe']);
    const game = (window.__SCENE__ as unknown as { game: Game }).game;
    game.world.installMountedGun({ x: 0, y: 0, z: 4, yaw: 0 }); a.teleport('player', { x: -1.2, z: 4 }); await a.step(1);
  });
  await page.keyboard.press('e'); await tick(page, 1);
  const gun = () => page.evaluate(() => (window.__SCENE__ as unknown as { game: Game }).game.world.mountedGun!.mounted);
  expect(await gun()).toBe(true);
  const weapons = () => page.evaluate(() => {
    const w = window.__SS__!.getState().player!.weapons!;
    const side = (s: typeof w.LEFT) => ({ index: s.index, rack: s.rack, swapUntil: s.swapUntil });
    return { selectedSide: w.selectedSide, LEFT: side(w.LEFT), RIGHT: side(w.RIGHT) };
  });
  const mounted = await weapons();
  for (const key of ['2', '3']) { await page.keyboard.press(key); await tick(page, 20); expect(await gun()).toBe(true); expect(await weapons()).toEqual(mounted); }
  await page.keyboard.press('e'); await tick(page, 1); expect(await gun()).toBe(false);
  await page.evaluate(async () => { const a = window.__SS__!; await a.loadScenario('drive-course'); a.pause(); a.setLoadout(['weapon.bat'], ['weapon.fire-axe']); });
  await page.mouse.click(800, 450, { button: 'middle' }); await tick(page, 1);
  expect(await page.evaluate(() => window.__SS__!.getState().player!.hidden)).toBe(true);
  const driving = await weapons();
  await page.keyboard.press('3'); await tick(page, 20); expect(await weapons()).toEqual(driving);
  await page.keyboard.press('e'); await tick(page, 20);
  expect(await page.evaluate(() => window.__SS__!.getState().player!.hidden)).toBe(false);
  expect(await weapons()).toEqual(driving);
  await page.keyboard.press('3'); await tick(page, 20); expect((await weapons()).selectedSide).toBe('RIGHT');
});
