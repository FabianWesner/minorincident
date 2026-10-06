import { devices } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect } from './fixtures';
const output = 'test-results/epics/E18';
for (const profile of ['Pixel 7', 'iPhone 14'] as const) {
  test.describe(profile, () => {
    test.use({ viewport: devices[profile].viewport, deviceScaleFactor: devices[profile].deviceScaleFactor, userAgent: devices[profile].userAgent, isMobile: true, hasTouch: true });
    test(`T-E18-07-${profile} @E18-AC07 @vision L1 touch gameplay, auto low, portrait/landscape and safe areas`, async ({ page, context }) => {
      test.setTimeout(180_000);
      await page.goto('/?test=1&renderer=webgl&quality=auto&audio=muted&dpr=3');
      await page.waitForFunction(() => Boolean(window.__SS__));
      await page.evaluate(async () => { const a = window.__SS__!; await a.ready; await a.loadLevel('L1'); a.missions.begin(); a.pause(); await a.screenshotReady(); });
      const cdp = await context.newCDPSession(page);
      const proof = [];
      for (const [width, height] of [[390, 844], [844, 390]]) {
        await page.setViewportSize({ width, height });
        const start = { id: 1, x: 70, y: height / 2 };
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...start, x: 130 }] });
        await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
        const state = await page.evaluate(async () => {
          const a = window.__SS__!; await a.step(30); await a.screenshotReady();
          return { perf: a.perf(), state: a.getState(), viewport: { width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight }, canvas: { width: document.querySelector('canvas')!.width, height: document.querySelector('canvas')!.height }, controls: [...document.querySelectorAll<HTMLElement>('[data-touch-action]')].filter(e => !e.hidden).map(e => ({ action: e.dataset.touchAction, x: e.getBoundingClientRect().x, y: e.getBoundingClientRect().y, right: e.getBoundingClientRect().right, bottom: e.getBoundingClientRect().bottom })) };
        });
        expect(state.perf.quality).toMatchObject({ setting: 'auto', tier: 'low' }); expect(state.state.mission).toMatchObject({ phase: 'playing' });
        expect(state.state.input.scheme).toBe('touch'); expect(Math.hypot(state.state.input.frame.move.x, state.state.input.frame.move.z)).toBeGreaterThan(.9);
        expect(state.viewport.scrollWidth).toBeLessThanOrEqual(width); expect(state.viewport.scrollHeight).toBeLessThanOrEqual(height);
        expect(state.canvas.width).toBe(Math.floor(width * 1.5)); expect(state.canvas.height).toBe(Math.floor(height * 1.5));
        for (const rect of state.controls) { expect(rect.x).toBeGreaterThanOrEqual(0); expect(rect.y).toBeGreaterThanOrEqual(0); expect(rect.right).toBeLessThanOrEqual(width); expect(rect.bottom).toBeLessThanOrEqual(height); }
        proof.push(state); mkdirSync(output, { recursive: true }); await page.screenshot({ path: `${output}/${profile.replaceAll(' ', '-')}-${width}.png` });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.evaluate(() => window.__SS__!.step(1));
        expect(await page.evaluate(() => window.__SS__!.getState().input.frame.move)).toEqual({ x: 0, z: 0 });
      }
      writeFileSync(`${output}/${profile.replaceAll(' ', '-')}.json`, JSON.stringify(proof, null, 2));
    });
  });
}
