import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from './fixtures';
import { menuStart } from './ui-helpers';
import { tick } from './input-helpers';

const output = 'test-results/controls-v2';

test('S-02 @smoke @E03 @E03-AC14 @E03-AC16 real L1 mouse play: click to move, stop, RMB cycle and stationary Shift LMB', async ({ page }) => {
  await menuStart(page);
  await page.evaluate(() => window.__SS__!.pause());
  const start = await page.evaluate(() => window.__SS__!.getState().player!.transform);
  // +X is fenced and +Z can be occupied by the bicycle's safe parking spot.
  // Walk along the open sidewalk away from the parked bike to test arrival.
  const point = await page.evaluate(p => window.__SS__!.input.project({ x: p.x, z: p.z - 2 }), start);
  await page.mouse.move(point.x, point.y); await tick(page, 30);
  const idle = await page.evaluate(() => window.__SS__!.getState().player!.transform);
  expect(Math.hypot(idle.x - start.x, idle.z - start.z)).toBeLessThan(.02);
  await page.mouse.click(point.x, point.y); await tick(page, 1);
  await page.evaluate(() => window.__SS__!.screenshotReady());
  expect(await page.evaluate(() => window.__SS__!.getState().render.moveMarker!.visible)).toBe(true);
  mkdirSync(output, { recursive: true }); await page.screenshot({ path: `${output}/l1-desktop-marker.png` });
  await tick(page, 120);
  const arrived = await page.evaluate(() => window.__SS__!.getState().player!.transform);
  expect(Math.hypot(arrived.x - start.x, arrived.z - start.z + 2)).toBeLessThan(.15);
  expect(await page.evaluate(() => window.__SS__!.getState().render.moveMarker!.visible)).toBe(false);
  expect(await page.evaluate(() => window.__SS__!.getState().player!.weapons)).toBeUndefined();
  // Before the L1 unarmed pickup, cycling has no action to select. The fixture
  // below supplies carried actions; the E19 playthrough earns them in-game.
  await page.mouse.click(point.x, point.y, { button: 'right' }); await tick(page, 1);
  expect(await page.evaluate(() => window.__SS__!.events().some(e => e.type === 'combat.attack'))).toBe(false);
  await page.evaluate(() => window.__SS__!.setLoadout(['weapon.bat'], ['weapon.fists']));
  const far = await page.evaluate(p => window.__SS__!.input.project({ x: p.x + 2, z: p.z + 1 }), arrived);
  await page.mouse.click(far.x, far.y, { button: 'right' }); await tick(page, 20);
  expect(await page.evaluate(() => window.__SS__!.events().some(e => e.type === 'combat.attack'))).toBe(false);
  expect(await page.evaluate(() => window.__SS__!.getState().player!.weapons!.selectedSide)).toBe('RIGHT');
  await page.keyboard.down('Shift'); await page.mouse.click(far.x, far.y); await tick(page, 90); await page.keyboard.up('Shift');
  const attacked = await page.evaluate(() => window.__SS__!.getState());
  expect(Math.hypot(attacked.player!.transform.x - arrived.x, attacked.player!.transform.z - arrived.z)).toBeLessThan(.02);
  expect(await page.evaluate(() => window.__SS__!.events().some(e => e.type === 'combat.attack' && e.side === 'RIGHT'))).toBe(true);
  await page.evaluate(() => window.__SS__!.screenshotReady()); await page.screenshot({ path: `${output}/l1-desktop.png` });
  writeFileSync(`${output}/desktop.json`, JSON.stringify({ start, idle, arrived, attacked: attacked.player!.transform }, null, 2));
});

test.describe('L1 mobile play', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  test('@E03 @E03-AC06 @E03-AC18 real L1 touch stick and LEFT RIGHT ACTION', async ({ page, context }) => {
    await menuStart(page); await page.evaluate(() => window.__SS__!.pause());
    await expect(page.getByTestId('touch-interact')).toBeDisabled();
    const start = await page.evaluate(() => window.__SS__!.getState().player!.transform), cdp = await context.newCDPSession(page);
    for (const [type, points] of [['touchStart', [{ x: 70, y: 420 }]], ['touchMove', [{ x: 130, y: 420 }]]] as const) {
      await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: [...points] });
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    }
    await tick(page, 30); await page.evaluate(() => window.__SS__!.screenshotReady());
    mkdirSync(output, { recursive: true }); await page.screenshot({ path: `${output}/l1-touch-stick.png` });
    const moved = await page.evaluate(() => window.__SS__!.getState().player!.transform);
    expect(Math.hypot(moved.x - start.x, moved.z - start.z)).toBeGreaterThan(1);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await tick(page, 20);
    const stopped = await page.evaluate(() => window.__SS__!.getState().player!.transform);
    for (const side of ['left', 'right']) { await page.getByTestId(`touch-${side}`).tap(); await tick(page, 40); }
    const end = await page.evaluate(() => window.__SS__!.getState().player!.transform);
    expect(Math.hypot(end.x - stopped.x, end.z - stopped.z)).toBeLessThan(.02);
    await expect(page.locator('[data-touch-action]')).toHaveCount(4); // Three gameplay buttons and the separate hidden fallback pause.
    await page.evaluate(() => window.__SS__!.screenshotReady()); await page.screenshot({ path: `${output}/l1-touch.png` });
    writeFileSync(`${output}/touch.json`, JSON.stringify({ start, moved, stopped, end }, null, 2));
  });
});
