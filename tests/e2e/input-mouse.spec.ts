import { boot, expect, test } from './fixtures';
import type { Page } from '@playwright/test';
import { tick } from './input-helpers';

async function point(page: Page, x: number, z = 0) {
  return page.evaluate((pos) => window.__SS__!.input.project(pos), { x, z });
}

test('T-E03-01 @E03 @E03-AC01 mouse dead zone and linear distance steering', async ({ page }) => {
  await boot(page);
  for (const [distance, magnitude] of [[1, 0], [1.2, 0], [3, 1.8 / 2.8], [4, 1], [5, 1]]) {
    await page.evaluate(() => window.__SS__!.teleport('player', { x: 0, z: 0 }));
    const pos = await point(page, distance); await page.mouse.move(pos.x, pos.y);
    const frame = await tick(page);
    expect(frame.move.x).toBeCloseTo(magnitude, 2); expect(Math.abs(frame.move.z)).toBeLessThan(0.01);
    expect(frame.aim!.x).toBeCloseTo(1, 2); expect(Math.abs(frame.aim!.z)).toBeLessThan(0.01);
    expect(frame.aimSource).toBe('pointer');
  }
});

test('T-E03-02 @E03 @E03-AC02 mouse buttons preserve down held up and prevent context menus', async ({ page }) => {
  await boot(page); await page.mouse.move(800, 450);
  for (const [button, action] of [['left', 'left'], ['right', 'right']] as const) {
    await page.mouse.down({ button });
    expect((await tick(page))[action]).toEqual({ down: true, held: true, up: false });
    expect((await tick(page))[action]).toEqual({ down: false, held: true, up: false });
    await page.mouse.up({ button });
    expect((await tick(page))[action]).toEqual({ down: false, held: false, up: true });
    await page.mouse.click(800, 450, { button });
    expect((await tick(page))[action]).toEqual({ down: true, held: false, up: true });
  }
  expect(await page.locator('canvas').evaluate((canvas) => {
    const event = new MouseEvent('contextmenu', { button: 2, bubbles: true, cancelable: true });
    canvas.dispatchEvent(event); return event.defaultPrevented;
  })).toBe(true);
});

test('T-E03-03 @E03 @E03-AC03 wheel notches pulse once and trackpads debounce 120ms', async ({ page }) => {
  await boot(page); await page.clock.install({ time: new Date('2025-01-01T00:00:00Z') }); await page.clock.pauseAt(new Date('2025-01-01T00:01:00Z')); await page.mouse.move(800, 450);
  await page.mouse.wheel(0, -100); expect((await tick(page)).selector).toBe(-1);
  expect((await tick(page)).selector).toBe(0);
  await page.mouse.wheel(0, 100); expect((await tick(page)).selector).toBe(1);
  await page.mouse.wheel(0, 8); expect((await tick(page)).selector).toBe(1);
  await page.mouse.wheel(0, 8); expect((await tick(page)).selector).toBe(0);
  await page.clock.runFor(119);
  await page.mouse.wheel(0, 8); expect((await tick(page)).selector).toBe(0);
  await page.clock.runFor(1);
  await page.mouse.wheel(0, -8); expect((await tick(page)).selector).toBe(-1);
});

test('T-E03-12 @E03 @E03-AC12 middle-click and E interact without browser autoscroll', async ({ page }) => {
  await boot(page); await page.mouse.move(800, 450);
  await page.mouse.down({ button: 'middle' }); expect((await tick(page)).interact).toBe(true);
  expect((await tick(page)).interact).toBe(false); await page.mouse.up({ button: 'middle' });
  await page.keyboard.down('e'); expect((await tick(page)).interact).toBe(true);
  expect((await tick(page)).interact).toBe(false); await page.keyboard.up('e');
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
