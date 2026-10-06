import { boot, expect, test } from './fixtures';
import { tick } from './input-helpers';

test('T-E03-04 @E03 @E03-AC04 WASD follows screen up at camera azimuth pi/4', async ({ page }) => {
  await boot(page); await page.keyboard.down('w');
  const before = await page.evaluate(() => { const p = window.__SS__!.getState().player!.transform; return window.__SS__!.input.project(p); });
  const frame = await tick(page, 30);
  const after = await page.evaluate(() => { const p = window.__SS__!.getState().player!.transform; return window.__SS__!.input.project(p); });
  expect(Math.hypot(frame.move.x, frame.move.z)).toBeCloseTo(1);
  expect(frame.move.x).toBeCloseTo(-Math.SQRT1_2); expect(frame.move.z).toBeCloseTo(-Math.SQRT1_2);
  const angle = Math.abs(Math.atan2(after.x - before.x, before.y - after.y)) * 180 / Math.PI;
  expect(after.y).toBeLessThan(before.y); expect(angle).toBeLessThan(5);
  await page.keyboard.up('w'); expect((await tick(page)).move).toEqual({ x: 0, z: 0 });
});

test('T-E03-05 @E03 @E03-AC05 keyboard aim turns at 360deg/s, taps snap and action mirrors fire', async ({ page }) => {
  await boot(page); await page.clock.install(); await page.clock.pauseAt(new Date());
  await page.keyboard.down('ArrowLeft');
  const rotating = await tick(page, 6);
  expect(Math.atan2(rotating.aim!.z, rotating.aim!.x)).toBeCloseTo(Math.PI / 5, 4);
  await page.clock.runFor(150); await page.keyboard.up('ArrowLeft');
  expect((await tick(page)).aim).toEqual(rotating.aim);
  await page.keyboard.down('ArrowUp'); await page.clock.runFor(100); await page.keyboard.up('ArrowUp');
  const snapped = await tick(page); expect(snapped.aim!.x).toBeCloseTo(-Math.SQRT1_2); expect(snapped.aim!.z).toBeCloseTo(-Math.SQRT1_2);
  const directions = [
    { keys: ['ArrowUp'], x: -Math.SQRT1_2, z: -Math.SQRT1_2 },
    { keys: ['ArrowUp', 'ArrowRight'], x: 0, z: -1 },
    { keys: ['ArrowRight'], x: Math.SQRT1_2, z: -Math.SQRT1_2 },
    { keys: ['ArrowDown', 'ArrowRight'], x: 1, z: 0 },
    { keys: ['ArrowDown'], x: Math.SQRT1_2, z: Math.SQRT1_2 },
    { keys: ['ArrowDown', 'ArrowLeft'], x: 0, z: 1 },
    { keys: ['ArrowLeft'], x: -Math.SQRT1_2, z: Math.SQRT1_2 },
    { keys: ['ArrowUp', 'ArrowLeft'], x: -1, z: 0 },
  ];
  for (const direction of directions) {
    for (const key of direction.keys) await page.keyboard.down(key);
    await page.clock.runFor(100);
    for (const key of direction.keys) await page.keyboard.up(key);
    const frame = await tick(page);
    expect(frame.aim!.x).toBeCloseTo(direction.x, 4); expect(frame.aim!.z).toBeCloseTo(direction.z, 4);
  }
  for (const [key, side] of [['j', 'left'], ['k', 'right'], ['Space', 'left'], ['Shift', 'right']] as const) {
    await page.keyboard.down(key); expect((await tick(page))[side]).toEqual({ down: true, held: true, up: false });
    await page.keyboard.up(key); expect((await tick(page))[side]).toEqual({ down: false, held: false, up: true });
  }
  for (const key of ['q', 'l']) { await page.keyboard.press(key); expect((await tick(page)).selector).toBe(1); }
  for (const key of ['Escape', 'p']) { await page.keyboard.press(key); expect((await tick(page)).pause).toBe(true); expect((await tick(page)).pause).toBe(false); }
});

test('T-E03-08 @E03 @E03-AC08 last device selects mouse-only mouse-keyboard and keyboard with matching hint', async ({ page }) => {
  await boot(page); await page.mouse.move(800, 450); await tick(page);
  await expect(page.locator('[data-input-hint]')).toHaveAttribute('data-scheme', 'mouse-only');
  await page.keyboard.down('w'); await tick(page);
  expect(await page.evaluate(() => window.__SS__!.getState().input.scheme)).toBe('mouse-keyboard');
  await expect(page.locator('[data-input-hint]')).toContainText('WASD + cursor');
  await page.evaluate(() => window.__SS__!.screenshotReady());
  await page.screenshot({ path: 'test-results/epics/E03/desktop.png' });
  await page.keyboard.up('w'); await page.keyboard.press('ArrowRight'); await tick(page);
  expect(await page.evaluate(() => window.__SS__!.getState().input.scheme)).toBe('keyboard');
  await expect(page.locator('[data-input-hint]')).toContainText('aim assist');
  await page.keyboard.press('j'); await tick(page);
  expect(await page.evaluate(() => window.__SS__!.getState().input.scheme)).toBe('keyboard');
  await page.mouse.move(801, 450); await tick(page);
  expect(await page.evaluate(() => window.__SS__!.getState().input.scheme)).toBe('mouse-only');
});

test('T-E03-09 @E03 @E03-AC09 binding form persists across reload and rejects conflicts with a message', async ({ page }) => {
  await boot(page); await page.getByText('Controls', { exact: true }).click();
  await page.locator('select[name=action]').selectOption('left'); await page.locator('input[name=code]').fill('KeyZ'); await page.getByRole('button', { name: 'Bind', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('left bound to KeyZ');
  // Clicking the canvas removes focus from the form before gameplay key events.
  await page.mouse.click(800, 450); await tick(page);
  await page.keyboard.down('z'); expect((await tick(page)).left.held).toBe(true); await page.keyboard.up('z'); await tick(page);
  await boot(page); await page.keyboard.down('z'); expect((await tick(page)).left.down).toBe(true); await page.keyboard.up('z');
  await page.getByText('Controls', { exact: true }).click(); await page.locator('select[name=action]').selectOption('right');
  await page.locator('input[name=code]').fill('KeyZ'); await page.getByRole('button', { name: 'Bind', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('already bound to left');
  expect(await page.evaluate(() => window.__SS__!.input.bindings().right)).toContain('KeyK');
});

test('T-E03-05-assist @E03 @E03-AC05 keyboard WASD J K Q F with nearest infected in facing direction', async ({ page }) => {
  await boot(page); await page.evaluate(async () => { const a = window.__SS__!; await a.loadScenario('combat-arena'); a.pause(); a.setLoadout(['weapon.pistol', 'weapon.bat'], ['weapon.pistol', 'weapon.grenade']); });
  await page.keyboard.down('d'); await tick(page, 30); await page.keyboard.up('d'); await tick(page, 20);
  const ids = await page.evaluate(() => {
    const a = window.__SS__!, p = a.getState().player!.transform, facing = -p.yaw;
    const spawn = (angle: number, range: number) => a.spawn('infected.dummy', { x: p.x + Math.cos(angle) * range, z: p.z + Math.sin(angle) * range }, { hp: 1000 });
    return [spawn(facing + .5, 1.2), spawn(facing + Math.PI, .9)];
  });
  for (const key of ['j', 'k']) { await page.keyboard.press(key); expect((await tick(page)).aimSource).toBe('assist'); await tick(page, 40); }
  const hits = await page.evaluate(() => window.__SS__!.events().filter(e => e.type === 'combat.hit'));
  expect(hits.filter(e => e.type === 'combat.hit' && e.targetId === ids[0])).toHaveLength(2);
  expect(hits.some(e => e.type === 'combat.hit' && e.targetId === ids[1])).toBe(false);
  await page.keyboard.press('q'); await tick(page);
  expect(await page.evaluate(() => window.__SS__!.getState().player!.weapons!.RIGHT.index)).toBe(1);
  await page.keyboard.press('f'); expect((await tick(page)).interact).toBe(true);
});
