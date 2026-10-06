import type { CDPSession, Page } from '@playwright/test';
import { boot, expect, test } from './fixtures';
import { tick } from './input-helpers';

const start = async (page: Page) => { await boot(page); await page.evaluate(async () => { const a = window.__SS__!; await a.loadScenario('survivor'); a.pause(); }); };
const position = (page: Page) => page.evaluate(() => window.__SS__!.getEntity(1)!.transform);
const speed = (page: Page) => page.evaluate(() => { const v = window.__SS__!.getEntity(1)!.survivor!.velocity; return Math.hypot(v.x, v.z); });

test('E19 @E19 @E19-AC13 keyboard runs by default; holding C or Alt walks at 2.0 m/s; release runs again within 0.2 s', async ({ page }) => {
  await start(page);
  await page.keyboard.down('d'); await tick(page, 40); expect(await speed(page)).toBeCloseTo(4.5, 1);
  for (const key of ['c', 'Alt']) {
    await page.keyboard.down(key); const frame = await tick(page, 40);
    expect(frame.walk).toBe(true); expect(await speed(page)).toBeCloseTo(2, 1);
    await page.keyboard.up(key); await tick(page, 12); expect(await speed(page)).toBeGreaterThan(4.4);
  }
  await page.keyboard.up('d');
});

test('E19 @E19 @E19-AC13 click-to-move runs; Alt+click walks', async ({ page }) => {
  await start(page);
  const click = async (alt: boolean) => {
    const p = await page.evaluate(() => window.__SS__!.getState().player!.transform);
    const point = await page.evaluate(q => window.__SS__!.input.project({ x: q.x + 4.6, z: q.z - 4.6 }), p);
    if (alt) await page.keyboard.down('Alt');
    await page.mouse.click(point.x, point.y); let top = 0;
    // Navigation reports its bounded response, so measure travelled distance per 5 ticks.
    for (let i = 0; i < 16; i++) { const a = await position(page); await tick(page, 5); const b = await position(page); top = Math.max(top, Math.hypot(b.x - a.x, b.z - a.z) * 12); }
    if (alt) await page.keyboard.up('Alt');
    await tick(page, 120); return top;
  };
  const run = await click(false), walk = await click(true);
  expect(run).toBeGreaterThan(4.3); expect(run).toBeLessThan(4.6);
  expect(walk).toBeGreaterThan(1.85); expect(walk).toBeLessThan(2.1);
});

test.describe('touch', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  const touch = async (cdp: CDPSession, type: 'touchStart' | 'touchMove' | 'touchEnd', points: { id: number; x: number; y: number }[]) => {
    await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(p => ({ ...p, radiusX: 1, radiusY: 1 })) });
    await cdp.send('Runtime.evaluate', { expression: 'new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))', awaitPromise: true });
  };
  test('E19 @E19 @E19-AC13 a light stick push walks, beyond half deflection runs', async ({ page, context }) => {
    await start(page); const cdp = await context.newCDPSession(page), finger = { id: 1, x: 90, y: 422 };
    await touch(cdp, 'touchStart', [finger]);
    await touch(cdp, 'touchMove', [{ ...finger, x: finger.x + 20 }]); await tick(page, 40); expect(await speed(page)).toBeCloseTo(2, 1);
    await touch(cdp, 'touchMove', [{ ...finger, x: finger.x + 55 }]); await tick(page, 12); expect(await speed(page)).toBeGreaterThan(4.4);
    await touch(cdp, 'touchEnd', []);
  });
});

test('E19 @E19 @E19-AC13 the walk hint appears once after running and never again', async ({ page }) => {
  await page.addInitScript(() => { if (!sessionStorage.getItem('g-once')) { sessionStorage.setItem('g-once', '1'); localStorage.setItem('minor-incident.walk-hint.v1', 'force'); } });
  await start(page); await page.keyboard.down('d'); await tick(page, 130);
  await expect(page.getByTestId('walk-hint')).toBeVisible(); await expect(page.getByTestId('walk-hint')).toHaveText('Hold C or Alt to walk');
  await page.keyboard.down('c'); await tick(page, 2); await expect(page.getByTestId('walk-hint')).toBeHidden(); await page.keyboard.up('c');
  await page.keyboard.up('d'); await page.reload(); await start(page); await page.keyboard.down('d'); await tick(page, 200);
  await expect(page.getByTestId('walk-hint')).toBeHidden(); await page.keyboard.up('d');
});
