import { boot, expect, test } from '../fixtures';

test('T-E29-05-browser @E29-AC05 rocket HUD stays Ready and firing has no ammunition/reload state', async ({ page }) => {
  await boot(page, '/?test=1&ui=1&renderer=webgl&quality=high&audio=muted&dpr=1'); const result = await page.evaluate(async () => {
    const a = window.__SS__!; await a.loadScenario('combat-arena'); a.pause(); a.setLoadout(['weapon.rocket-launcher'], ['weapon.kick']);
    a.input.set({ aim: { x: 1, z: 0 }, left: { down: false, held: true, up: false } });
    await a.step(300); a.input.clear();
    return { events: a.events(0).filter(e => e.type === 'combat.attack'), slot: a.getState().player!.weapons!.LEFT.rack[0] };
  });
  expect(result.events).toHaveLength(4);
  expect(result.events.slice(1).every((e, i) => e.tick - result.events[i].tick === 75)).toBe(true);
  expect(result.slot).toMatchObject({ magazine: 0, charges: 0, reloadUntil: 0 });
  await expect(page.getByTestId('stats-LEFT')).toContainText('Ready');
});

test('T-E29-04-browser @E29-AC04 real E collects the rocket beside the wreck and retains the arsenal', async ({ page }) => {
  await boot(page, '/?test=1&scenelab=1&renderer=webgl&quality=high&audio=muted&dpr=1');
  await page.waitForFunction(() => !!window.__SCENE__);
  await page.evaluate(async () => {
    await window.__SCENE__!.load({ name: 'rocket-pickup-input', ground: 'asphalt', size: 24, time: 'night', dof: false,
      props: [{ asset: 'veh.military-truck', decay: 'wrecked', at: [3, -3] }],
      actors: [{ id: 'courier', kind: 'courier', at: [3, 1.2], loadout: [['weapon.bat', 'weapon.fire-axe'], ['weapon.handgun', 'weapon.army-mg', 'weapon.shotgun']], state: 'idle' }],
      camera: { mode: 'game', target: [3, 0] }, script: [{ frame: 0, effect: { weaponPickup: 'weapon.rocket-launcher', at: [3, 0] } }],
    });
    await window.__SCENE__!.step(1); window.__SS__!.input.clear();
  });
  await page.keyboard.down('e');
  await page.evaluate(() => window.__SS__!.resume());
  await expect.poll(() => page.evaluate(() => window.__SS__!.getState().player!.weapons!.RIGHT.rack.map(s => s.id)), { timeout: 15000 }).toContain('weapon.rocket-launcher');
  await page.keyboard.up('e'); await page.evaluate(() => window.__SS__!.pause());
  const weapons = await page.evaluate(() => window.__SS__!.getState().player!.weapons!);
  expect([...weapons.LEFT.rack, ...weapons.RIGHT.rack].map(s => s.id)).toEqual(expect.arrayContaining(['weapon.bat', 'weapon.fire-axe', 'weapon.handgun', 'weapon.army-mg', 'weapon.shotgun', 'weapon.rocket-launcher']));
  expect(weapons.RIGHT.rack[weapons.RIGHT.index].id).toBe('weapon.rocket-launcher');
});
