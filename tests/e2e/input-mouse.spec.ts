import { boot, expect, test } from './fixtures';
import type { Page } from '@playwright/test';
import { tick } from './input-helpers';
import { hudStart } from './ui-helpers';

async function point(page: Page, x: number, z = 0) {
  return page.evaluate((pos) => window.__SS__!.input.project(pos), { x, z });
}

test('T-E03-01 @E03 @E03-AC01 cursor aims without moving', async ({ page }) => {
  await boot(page);
  for (const distance of [1, 3, 5]) {
    const pos = await point(page, distance); await page.mouse.move(pos.x, pos.y);
    const frame = await tick(page);
    expect(frame.move).toEqual({ x: 0, z: 0 }); expect(frame.moveTarget).toBeUndefined();
    expect(frame.aim!.x).toBeCloseTo(1, 2); expect(frame.aimSource).toBe('pointer');
  }
});

test('T-E03-02 @E03 @E03-AC02 mouse buttons preserve down held up and prevent context menus', async ({ page }) => {
  await boot(page); await page.mouse.move(800, 450);
  await page.mouse.down();
  expect((await tick(page)).left).toEqual({ down: true, held: true, up: false });
  expect((await tick(page)).left).toEqual({ down: false, held: true, up: false });
  await page.mouse.up(); expect((await tick(page)).left.up).toBe(true);
  await page.mouse.down({ button: 'right' });
  let frame = await tick(page); expect(frame.selector).toBe(1); expect(frame.right.down).toBe(false);
  frame = await tick(page); expect(frame.selector).toBe(0); expect(frame.right.held).toBe(false);
  await page.mouse.up({ button: 'right' }); expect((await tick(page)).right.up).toBe(false);
  expect(await page.locator('canvas').evaluate((canvas) => {
    const event = new MouseEvent('contextmenu', { button: 2, bubbles: true, cancelable: true });
    canvas.dispatchEvent(event); return event.defaultPrevented;
  })).toBe(true);
});

test('T-E03-03 @E03 @E03-AC03 @E02-AC03 wheel zooms smoothly and never cycles weapons', async ({ page }) => {
  await boot(page); await page.mouse.move(800,450);
  const before=await page.evaluate(()=>window.__SS__!.getState().render.camera);
  await page.mouse.wheel(0,-100); const frame=await tick(page,30);expect(frame.selector).toBe(0);
  const close=await page.evaluate(()=>window.__SS__!.getState().render.camera);expect(close.radius).toBeLessThan(before.radius);
  for(let i=0;i<12;i++)await page.mouse.wheel(0,120);await tick(page,120);
  const far=await page.evaluate(()=>window.__SS__!.getState().render.camera);expect(far.radius).toBeLessThanOrEqual(before.radius*far.zoomLimits[1]+.001);
  expect(far.azimuth).toBe(before.azimuth);expect(far.polar).toBe(before.polar);
});

test('T-E03-12 @E03 @E03-AC12 middle-click F and E interact without browser autoscroll', async ({ page }) => {
  await boot(page); await page.mouse.move(800, 450);
  await page.mouse.down({ button: 'middle' }); expect((await tick(page)).interact).toBe(true);
  expect((await tick(page)).interact).toBe(false); await page.mouse.up({ button: 'middle' });
  for (const key of ['f', 'e']) { await page.keyboard.down(key); expect((await tick(page)).interact).toBe(true);
    expect((await tick(page)).interact).toBe(false); await page.keyboard.up(key); }
  const defaults = await page.locator('canvas').evaluate((canvas) => ['mousedown', 'auxclick'].map((type) => {
    const event = new MouseEvent(type, { button: 1, bubbles: true, cancelable: true }); canvas.dispatchEvent(event); return event.defaultPrevented;
  }));
  expect(defaults).toEqual([true, true]);
  // E03 provides uninterrupted idle input for E11's stand-to-interact, with no physical device flags.
  await page.evaluate(async () => { await window.__SS__!.loadScenario('empty'); window.__SS__!.pause(); });
  const idle = await tick(page, 36); expect(idle.interact).toBe(false);
  expect(idle.move).toEqual({ x: 0, z: 0 });
  expect(idle.left).toEqual({ down: false, held: false, up: false });
  expect(idle.right).toEqual({ down: false, held: false, up: false });
  expect(await page.evaluate(() => ({ x: scrollX, y: scrollY }))).toEqual({ x: 0, y: 0 });
});

async function arena(page: Page) {
  await boot(page); await page.evaluate(async () => { const a = window.__SS__!; await a.loadScenario('combat-arena'); a.pause(); a.setLoadout(['weapon.bat', 'weapon.pistol'], ['weapon.bat', 'weapon.grenade']); });
}
async function position(page: Page) { return page.evaluate(() => window.__SS__!.getState().player!.transform); }

test('T-E03-14 @E03 @E03-AC14 click ground walks, retargets, stops and held ground follows cursor', async ({ page }) => {
  await arena(page); const dest = await point(page, 4);
  await page.mouse.click(dest.x, dest.y); const frame = await tick(page);
  expect(frame.moveTarget!.x).toBeCloseTo(4, 2);
  await tick(page, 20); expect((await position(page)).x).toBeGreaterThan(.5);
  const other = await point(page, 3, 2); await page.mouse.click(other.x, other.y); await tick(page, 120);
  const stopped = await position(page); expect(Math.hypot(stopped.x - 3, stopped.z - 2)).toBeLessThan(.15);
  await page.mouse.move(1400, 200); await tick(page, 120);
  expect(Math.hypot((await position(page)).x - stopped.x, (await position(page)).z - stopped.z)).toBeLessThan(.01);
  const held = await point(page, 5, 2); await page.mouse.move(held.x, held.y); await page.mouse.down(); await tick(page, 5);
  const retarget = await point(page, 6, 2); await page.mouse.move(retarget.x, retarget.y);
  expect((await tick(page)).moveTarget!.x).toBeCloseTo(6, 2); await page.mouse.up(); await tick(page, 120);
  expect(Math.hypot((await position(page)).x - 6, (await position(page)).z - 2)).toBeLessThan(.15);
  expect(await page.evaluate(() => window.__SS__!.events().filter(e => e.type === 'combat.attack'))).toEqual([]);
});

for (const button of ['left'] as const) test(`T-E03-15-${button} @E03 @E03-AC15 target click approaches then attacks ${button}`, async ({ page }) => {
  await arena(page);
  const id = await page.evaluate(() => window.__SS__!.spawn('infected.dummy', { x: 5, z: 0 }, { hp: 1000 }));
  const target = await point(page, 5); await page.mouse.click(target.x, target.y, { button });
  expect((await tick(page)).attackTarget).toEqual({ id, side: button === 'left' ? 'LEFT' : 'RIGHT' });
  await tick(page, 15); expect(await page.evaluate(() => window.__SS__!.events().some(e => e.type === 'combat.attack'))).toBe(false);
  expect(await page.evaluate(()=>window.__SS__!.getState().render.actions!.targetMarker)).toEqual({id,radius:.5});
  await tick(page, 90); expect((await position(page)).x).toBeGreaterThan(3);
  const events = await page.evaluate(() => window.__SS__!.events());
  expect(events.some(e => e.type === 'combat.attack' && e.side === (button === 'left' ? 'LEFT' : 'RIGHT'))).toBe(true);
  expect(events.some(e => e.type === 'combat.hit' && e.targetId === id)).toBe(true);
  // One click is one attack; holding repeats through the same real adapter.
  expect(events.filter(e => e.type === 'combat.attack')).toHaveLength(1);
});

test('T-E03-16 @E03 @E03-AC16 Shift LMB distant ground swings stationary and cancels destination', async ({ page }) => {
  await arena(page); const dest = await point(page, 7);
  await page.mouse.click(dest.x, dest.y); await tick(page, 10);
  const start = await position(page);
  await page.keyboard.down('Shift'); await page.keyboard.down('w');
  await page.mouse.move(dest.x, dest.y); await page.mouse.down(); const frame = await tick(page, 60);
  expect(frame.attackInPlace).toBe(true);
  expect(Math.hypot((await position(page)).x - start.x, (await position(page)).z - start.z)).toBeLessThan(.01);
  await page.mouse.up();
  await page.keyboard.up('w'); await page.keyboard.up('Shift');
  const attacks = await page.evaluate(() => window.__SS__!.events().filter(e => e.type === 'combat.attack'));
  expect(attacks.length).toBeGreaterThan(1);
  expect(attacks[0]).toMatchObject({ side: 'LEFT' });
  if (attacks[0].type === 'combat.attack') expect(Math.hypot(attacks[0].position.x - start.x, attacks[0].position.z - start.z)).toBeLessThan(.00001);
});

test('T-E03-17 @E03 @E03-AC17 RMB and Q cycle carried actions without attacking', async ({ page }) => {
  await arena(page); const dest = await point(page, 7);
  await page.mouse.click(dest.x, dest.y, { button: 'right' }); await tick(page, 20);
  let weapons = await page.evaluate(() => window.__SS__!.getState().player!.weapons!);
  expect(weapons.selectedSide).toBe('LEFT'); expect(weapons.LEFT.index).toBe(1);
  await page.mouse.click(dest.x, dest.y); await tick(page, 20);
  await page.keyboard.press('q'); await tick(page, 20);
  weapons = await page.evaluate(() => window.__SS__!.getState().player!.weapons!);
  expect(weapons.selectedSide).toBe('RIGHT'); expect(weapons.RIGHT.index).toBe(1);
  expect(await page.evaluate(() => window.__SS__!.events().filter(e => e.type === 'combat.attack'))).toEqual([]);
});

test('T-E03-12-car @E03 @E03-AC12 middle-click near car immediately enters; F exits', async ({ page }) => {
  await boot(page); await page.evaluate(async () => { await window.__SS__!.loadScenario('drive-course'); window.__SS__!.pause(); });
  await page.mouse.click(800, 450, { button: 'middle' }); await tick(page);
  expect(await page.evaluate(() => window.__SS__!.getState().player!.hidden)).toBe(true);
  await page.keyboard.press('f'); await tick(page);
  expect(await page.evaluate(() => window.__SS__!.getState().player!.hidden)).toBe(false);
});

test('T-E03-15-held @E03 @E03-AC15 held LMB target repeats and target death stops approach', async ({ page }) => {
  await arena(page);
  const id = await page.evaluate(() => window.__SS__!.spawn('infected.dummy', { x: 4, z: 0 }, { hp: 1000 }));
  const target = await point(page, 4); await page.mouse.move(target.x, target.y); await page.mouse.down(); await tick(page, 80);
  const away = await point(page, -4, 3); await page.mouse.move(away.x, away.y); await tick(page, 100);
  expect(await page.evaluate(() => window.__SS__!.events().filter(e => e.type === 'combat.attack').length)).toBeGreaterThan(2);
  await page.mouse.up(); await tick(page, 40);
  const count = await page.evaluate(() => window.__SS__!.events().filter(e => e.type === 'combat.attack').length);
  await tick(page, 90); expect(await page.evaluate(() => window.__SS__!.events().filter(e => e.type === 'combat.attack').length)).toBe(count);
  await page.evaluate(id => window.__SS__!.teleport(id, { x: 8, z: 0 }), id);
  const far = await point(page, 8); await page.mouse.click(far.x, far.y); await tick(page, 5);
  await page.evaluate(id => window.__SS__!.interact.hit(id, 10000, 'bullet'), id);
  expect(await page.evaluate(id => window.__SS__!.getEntity(id)!.health.current, id)).toBe(0); await tick(page, 20);
  const stopped = await position(page); await tick(page, 90);
  expect(Math.hypot((await position(page)).x - stopped.x, (await position(page)).z - stopped.z)).toBeLessThan(.01);
});

test('T-E03-17-pending @E03 @E03-AC15 @E03-AC17 Q during target command waits for swap then attacks once', async ({ page }) => {
  await arena(page);
  const id = await page.evaluate(() => window.__SS__!.spawn('infected.dummy', { x: 1, z: 0 }, { hp: 1000 }));
  const target = await point(page, 1); await page.mouse.click(target.x, target.y);
  await page.keyboard.press('q'); await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await tick(page, 30);
  const events = await page.evaluate(() => window.__SS__!.events().filter(e => e.type === 'combat.attack'));
  expect(events).toHaveLength(1); expect(events[0]).toMatchObject({ side: 'LEFT', actionId: 'weapon.pistol' });
  expect(await page.evaluate(id => window.__SS__!.getEntity(id)!.health.current, id)).toBeLessThan(1000);
});

test('T-E03-15-live @E03 @E03-AC15 real LMB follows a moving infected and attacks it', async ({ page }) => {
  await boot(page);
  const id = await page.evaluate(async () => {
    const a = window.__SS__!; await a.loadScenario('horde-arena'); a.pause(); a.cheats.god(true);
    a.setLoadout(['weapon.bat'], ['weapon.kick']);
    return a.spawn('infected.runner', { x: 5, z: 0 }, { state: 'chase', yaw: Math.PI });
  });
  const target = await point(page, 5); await page.mouse.click(target.x, target.y);
  expect((await tick(page)).attackTarget).toEqual({ id, side: 'LEFT' });
  await tick(page, 10); expect((await position(page)).x).toBeGreaterThan(.1);
  await tick(page, 100);
  const events = await page.evaluate(() => window.__SS__!.events());
  expect(events.some(e => e.type === 'combat.attack' && e.sourceId === 1 && e.side === 'LEFT')).toBe(true);
  expect(events.some(e => e.type === 'combat.hit' && e.sourceId === 1 && e.targetId === id)).toBe(true);
  expect(await page.evaluate(id => window.__SS__!.getEntity(id)!.health.current, id)).toBeLessThan(40);
});

test('T-E03-chord @E03 @E03-AC02 @E03-AC13 releasing LMB before RMB clears both independently', async ({ page }) => {
  await boot(page);
  await page.mouse.move(1200, 350); await page.mouse.down({ button: 'left' });
  expect((await tick(page)).left.held).toBe(true);
  await page.mouse.down({ button: 'right' });
  const both = await tick(page); expect(both.left.held).toBe(true); expect(both.selector).toBe(1); expect(both.right.held).toBe(false);
  await page.mouse.up({ button: 'left' });
  const partial = await tick(page); expect(partial.left.up).toBe(true); expect(partial.left.held).toBe(false); expect(partial.right.held).toBe(false);
  await page.mouse.up({ button: 'right' });
  const released = await tick(page); expect(released.right.up).toBe(false); expect(released.right.held).toBe(false); expect(released.left.held).toBe(false);
  const idle = await tick(page, 60); expect(idle.left).toEqual({ down: false, held: false, up: false }); expect(idle.right).toEqual({ down: false, held: false, up: false });
});


test('@E03-AC05 @E03-AC17 M1-05 numbers and HUD clicks select either rack; Shift never attacks',async({page})=>{
  await hudStart(page);
  await page.evaluate(()=>window.__SS__!.setLoadout(['weapon.bat','weapon.crowbar','weapon.machete'],['weapon.kick','weapon.fists','weapon.bat']));
  await page.keyboard.press('3');await tick(page,20);
  expect(await page.evaluate(()=>window.__SS__!.getState().player!.weapons!.LEFT.index)).toBe(2);
  await page.keyboard.press('Shift+2');const frame=await tick(page,20);expect(frame.right.down).toBe(false);
  expect(await page.evaluate(()=>window.__SS__!.getState().player!.weapons!.RIGHT.index)).toBe(1);
  await page.getByTestId('slot-LEFT').click();await tick(page,20);
  expect(await page.evaluate(()=>window.__SS__!.getState().player!.weapons!.LEFT.index)).toBe(0);
  await page.getByTestId('slot-RIGHT').click();await tick(page,20);
  expect(await page.evaluate(()=>window.__SS__!.getState().player!.weapons!.RIGHT.index)).toBe(2);
});
