import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect } from './fixtures';
import { menuStart, menuUrl } from './ui-helpers';

for (const mode of ['desktop', 'iphone-portrait'] as const) test.describe(mode, () => {
  test.use({ viewport: mode === 'desktop' ? { width: 1600, height: 900 } : { width: 390, height: 844 }, hasTouch: mode !== 'desktop', isMobile: mode !== 'desktop' });
  test(`@E19 M1-world real-input hedge collision, forecourt access and resting companion ${mode}`, async ({ page, context }) => {
    test.setTimeout(240_000); const directory = '.cache/m1-world'; mkdirSync(directory, { recursive: true });
    if (mode === 'desktop') await menuStart(page);
    else {
      await page.goto(menuUrl);
      for (const id of ['start-game', 'character-female', 'level-L1', 'mission-button']) await page.getByTestId(id).tap();
      await expect(page.getByTestId('pause-button')).toBeVisible();
    }
    await page.evaluate(() => window.__SS__!.pause());
    const cdp = mode === 'desktop' ? null : await context.newCDPSession(page);
    const step = async (ticks: number) => page.evaluate(ticks => window.__SS__!.step(ticks), ticks);
    const photograph = async (label: string) => { await page.evaluate(() => window.__SS__!.screenshotReady()); await page.screenshot({ path: `${directory}/${mode}-${label}.png` }); };
    const move = async (x: number, z: number) => {
      for (let i = 0; i < 180; i++) {
        const p = await page.evaluate(() => window.__SS__!.getState().player!.transform), distance = Math.hypot(x - p.x, z - p.z);
        if (distance < .3) return;
        const dx = (x - p.x) / distance, dz = (z - p.z) / distance;
        if (cdp) {
          const origin = { id: 1, x: 70, y: 506 };
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [origin] });
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...origin, x: origin.x + (dx - dz) / Math.SQRT2 * 50, y: origin.y + (dx + dz) / Math.SQRT2 * 50 }] });
          await step(Math.max(1, Math.min(18, Math.floor(distance / 5 * 60))));
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await step(6);
        } else {
          const target = await page.evaluate(p => window.__SS__!.input.project(p), { x: p.x + dx * Math.min(2, distance), z: p.z + dz * Math.min(2, distance) });
          await page.mouse.click(target.x, target.y); await step(24);
        }
      }
      await photograph('stalled');
      throw new Error(`Movement stalled to ${x},${z}: ${JSON.stringify(await page.evaluate(() => window.__SS__!.getState().player!.transform))}`);
    };
    await photograph('morning');
    await move(-14, -4); await move(-19, -4.5); await move(-19, -6.3);
    if (mode === 'desktop') {
      // A single genuine ground click must route around the visible hedge.
      const point = await page.evaluate(() => window.__SS__!.input.project({ x: -15, z: -6.3 }));
      await page.mouse.click(point.x, point.y); await step(240);
      const p = await page.evaluate(() => window.__SS__!.getState().player!.transform); expect(Math.hypot(p.x + 15, p.z + 6.3)).toBeLessThan(.2);
    } else {
      // Direct joystick input collides instead of passing through the hedge.
      const origin = { id: 1, x: 70, y: 506 };
      await cdp!.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [origin] });
      await cdp!.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...origin, x: origin.x + 35, y: origin.y + 35 }] }); await step(90);
      await cdp!.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await step(6);
      const p = await page.evaluate(() => window.__SS__!.getState().player!.transform); expect(p.x).toBeLessThan(-18.3);
      await move(-19, -4.5); await move(-15, -4.5);
    }
    await photograph('hedge'); await move(-14, -4); await move(0, 0); await move(42, 0); await move(52, 0); await move(52, 18); await move(46.75, 18); await move(46.75, 15); await move(45, 15); await move(45, 14.3);
    await photograph('forecourt'); await step(240);
    // Rest through animation frames: no body displacement/yaw churn at idle.
    const rest = await page.evaluate(() => window.__SS__!.query({ kind: 'companion' })[0]); await step(180);
    const dog = await page.evaluate(() => window.__SS__!.query({ kind: 'companion' })[0]);
    expect(Math.hypot(dog.transform.x - rest.transform.x, dog.transform.z - rest.transform.z)).toBeLessThan(.01);
    expect(dog.motion!.moving).toBe(false); expect(dog.motion!.speed).toBeLessThan(.01);
    const player = await page.evaluate(() => window.__SS__!.getState().player!.transform);
    expect(Math.hypot(player.x - 45, player.z - 14.3)).toBeLessThan(.3);
    expect(Math.hypot(player.x - dog.transform.x, player.z - dog.transform.z)).toBeLessThan(4);
    await photograph('idle');
    writeFileSync(`${directory}/${mode}-evidence.json`, JSON.stringify({ mode, viewport: page.viewportSize(), player, companion: dog.transform, companionSpeed: dog.motion!.speed, companionMoving: dog.motion!.moving, input: 'real mouse or CDP touch events only', passed: true }, null, 2));
    if (mode === 'desktop') {
      await page.goto(`${menuUrl}&debug`);
      for (const id of ['start-game', 'character-female', 'level-L1', 'mission-button']) await page.getByTestId(id).click();
      await expect(page.getByTestId('pause-button')).toBeVisible();
      await page.evaluate(() => window.__SS__!.pause()); await photograph('debug');
    }
  });
});
