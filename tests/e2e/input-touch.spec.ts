import type { CDPSession, Page } from '@playwright/test';
import { boot, expect, test } from './fixtures';
import { tick } from './input-helpers';

test.use({ hasTouch: true, isMobile: true });
test.beforeEach(async ({ page }, info) => {
  if (info.project.name === 'chromium') await page.setViewportSize({ width: 390, height: 844 });
  await boot(page);
});
interface Finger { id: number; x: number; y: number }
async function touch(cdp: CDPSession, type: 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel', fingers: Finger[]) {
  await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: fingers.map((finger) => ({ ...finger, radiusX: 1, radiusY: 1 })) });
  // Chromium may coalesce pointermove until the next compositor frame. Wait for delivery, then sample the next sim tick.
  await cdp.send('Runtime.evaluate', { expression: 'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))', awaitPromise: true });
}
async function center(page: Page, side: string) {
  const box = await page.locator(`[data-touch-action=${side}]`).boundingBox();
  expect(box).not.toBeNull(); return { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
}

test('T-E03-06 @E03 @E03-AC06 floating stick clamps a 60px drag and releases within one tick', async ({ page, context }, info) => {
  const cdp = await context.newCDPSession(page);
  const width = page.viewportSize()!.width;
  const start = { id: 1, x: width / 4, y: page.viewportSize()!.height / 2 };
  await touch(cdp, 'touchStart', [start]); await expect(page.locator('[data-touch-stick]')).toBeVisible();
  expect((await tick(page)).move).toEqual({ x: 0, z: 0 });
  await touch(cdp, 'touchMove', [{ ...start, x: start.x + 30 }]);
  const half = await tick(page); expect(Math.hypot(half.move.x, half.move.z)).toBeCloseTo(0.5, 2);
  await touch(cdp, 'touchMove', [{ ...start, x: start.x + 60 }]);
  const full = await tick(page); expect(Math.hypot(full.move.x, full.move.z)).toBeCloseTo(1, 2);
  await page.evaluate(() => window.__SS__!.screenshotReady());
  await page.screenshot({ path: `test-results/epics/E03/stick-${info.project.name}.png` });
  expect(full.move.x).toBeGreaterThan(0); expect(full.move.z).toBeLessThan(0);
  expect(await page.evaluate(() => window.__SS__!.getState().input.scheme)).toBe('touch');
  await expect(page.locator('[data-input-hint]')).toHaveAttribute('data-scheme', 'touch');
  await touch(cdp, 'touchEnd', []); expect((await tick(page)).move).toEqual({ x: 0, z: 0 });
  await expect(page.locator('[data-touch-stick]')).toBeHidden();
});

test('T-E03-07 @E03 @E03-AC07 action drag aims and fires only on release, tap uses assist', async ({ page, context }, info) => {
  const cdp = await context.newCDPSession(page); const pos = await center(page, 'right');
  const finger = { id: 1, ...pos };
  await touch(cdp, 'touchStart', [finger]); expect((await tick(page)).right.down).toBe(false);
  await touch(cdp, 'touchMove', [{ ...finger, y: pos.y - 60 }]);
  const aim = await tick(page); expect(aim.aimSource).toBe('touch'); expect(aim.right.down).toBe(false);
  await page.evaluate(() => window.__SS__!.screenshotReady());
  await page.screenshot({ path: `test-results/epics/E03/aim-${info.project.name}.png` });
  expect(aim.aim!.x).toBeCloseTo(-Math.SQRT1_2); expect(aim.aim!.z).toBeCloseTo(-Math.SQRT1_2);
  await touch(cdp, 'touchEnd', []); const fired = await tick(page);
  expect(fired.right).toEqual({ down: true, held: false, up: true }); expect(fired.aim).toEqual(aim.aim);
  expect((await tick(page)).right.down).toBe(false);
  await page.touchscreen.tap(pos.x, pos.y); const tap = await tick(page);
  expect(tap.right.down).toBe(true); expect(tap.aimSource).toBe('assist'); expect(tap.aim).toEqual(aim.aim);
  // Left mirrors the same release semantics; selector and pause are functional buttons.
  const left = await center(page, 'left'); await page.touchscreen.tap(left.x, left.y); expect((await tick(page)).left.down).toBe(true);
  for (const side of ['selector', 'pause']) {
    const p = await center(page, side); await page.touchscreen.tap(p.x, p.y);
    const f = await tick(page); expect(side === 'selector' ? f.selector : f.pause).toBe(side === 'selector' ? 1 : true);
  }
});

for (const loss of ['blur', 'hidden', 'pagehide'] as const) {
  test(`T-E03-13-${loss} @E03 @E03-AC13 focus loss releases W LMB and held stick without stale input`, async ({ page, context }) => {
    const cdp = await context.newCDPSession(page);
    await page.mouse.move(200, 250); await page.keyboard.down('w'); await page.mouse.down();
    const origin = { id: 1, x: 60, y: page.viewportSize()!.height / 2 }, drag = { ...origin, x: 120 };
    await touch(cdp, 'touchStart', [origin]); await touch(cdp, 'touchMove', [drag]);
    const held = await tick(page); expect(Math.hypot(held.move.x, held.move.z)).toBeCloseTo(1); expect(held.left.held).toBe(true);
    await page.evaluate((kind) => {
      if (kind === 'hidden') { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); }
      else window.dispatchEvent(new Event(kind));
    }, loss);
    const released = await tick(page); expect(released.move).toEqual({ x: 0, z: 0 });
    expect(released.left).toEqual({ down: false, held: false, up: true }); expect(released.right.held).toBe(false);
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('focus')); });
    // Existing contact moved after blur must not resurrect the abandoned stick.
    await touch(cdp, 'touchMove', [{ ...drag, x: 130 }]); const returned = await tick(page);
    expect(returned.move).toEqual({ x: 0, z: 0 }); expect(returned.left).toEqual({ down: false, held: false, up: false });
    await touch(cdp, 'touchEnd', []); await page.mouse.up(); await page.keyboard.up('w');
    await page.keyboard.down('w'); expect(Math.hypot(...Object.values((await tick(page)).move))).toBeCloseTo(1); await page.keyboard.up('w');
  });
}

test('T-E03-touch-schemes @E03 @E03-AC08 touch and keyboard switch immediately and hints follow', async ({ page }) => {
  await page.touchscreen.tap(60, 300); await tick(page);
  expect(await page.evaluate(() => window.__SS__!.getState().input.scheme)).toBe('touch');
  await page.keyboard.press('ArrowLeft'); await tick(page);
  await expect(page.locator('[data-input-hint]')).toHaveAttribute('data-scheme', 'keyboard');
  await page.touchscreen.tap(60, 300); await tick(page);
  await expect(page.locator('[data-input-hint]')).toHaveAttribute('data-scheme', 'touch');
});

test('T-E03-multitouch @E03 @E03-AC06 @E03-AC07 independent stick and action contacts, cancellation never fires', async ({ page, context }) => {
  const cdp = await context.newCDPSession(page);
  const stick = { id: 1, x: 60, y: page.viewportSize()!.height / 2 };
  const action = { id: 2, ...await center(page, 'right') };
  await touch(cdp, 'touchStart', [stick]);
  const moving = { ...stick, x: 120 };
  await touch(cdp, 'touchMove', [moving]);
  await touch(cdp, 'touchStart', [moving, action]);
  await touch(cdp, 'touchMove', [moving, { ...action, y: action.y - 60 }]);
  const aiming = await tick(page);
  expect(Math.hypot(aiming.move.x, aiming.move.z)).toBeCloseTo(1); expect(aiming.right.down).toBe(false);
  // Lift the action contact while keeping the stick contact pressed.
  await touch(cdp, 'touchEnd', [{ ...action, y: action.y - 60 }]);
  const firing = await tick(page); expect(firing.right.down).toBe(true); expect(Math.hypot(firing.move.x, firing.move.z)).toBeCloseTo(1);
  await touch(cdp, 'touchEnd', []); expect((await tick(page)).move).toEqual({ x: 0, z: 0 });
  await touch(cdp, 'touchStart', [action]); await touch(cdp, 'touchCancel', []);
  expect((await tick(page)).right).toEqual({ down: false, held: false, up: false });
});
