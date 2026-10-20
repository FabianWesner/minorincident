import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from './fixtures';

test.use({ hasTouch: true, isMobile: true });
test('#67 #72 #75 launcher equipment and responsive radar layout @E14-AC05', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/?test=1&ui=1&level=L7&renderer=webgl&quality=high&audio=muted&dpr=1');
  await page.waitForFunction(() => !!window.__SS__);
  await page.evaluate(async () => {
    const a = window.__SS__!; await a.ready; a.pause(); await a.loadLevel('L7', { seed: 2 }); if (a.missions.state()?.phase === 'briefing') a.missions.begin();
    a.pause(); a.cheats.god(true); a.setLoadout(['weapon.rocket-launcher'], ['weapon.fire-axe']); await a.step(1);
  });
  const dir = 'test-results/ui-radar-zoom'; mkdirSync(dir, { recursive: true });
  for (const [width, height] of [[1600, 900], [1024, 768], [390, 844], [844, 390]]) {
    await page.setViewportSize({ width, height });
    // Exercise the same pointer contacts as a hardware pinch, preserving the touch HUD.
    await page.evaluate(() => {
      const canvas = document.querySelector('canvas')!;
      const send = (type: string, id: number, x: number) => canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerType: 'touch', pointerId: id, clientX: x, clientY: innerHeight / 2 }));
      send('pointerdown', 91, 40); send('pointerdown', 92, 240); send('pointermove', 92, 60); send('pointerup', 91, 40); send('pointerup', 92, 60);
    });
    await page.evaluate(async () => { await window.__SS__!.step(90); await window.__SS__!.screenshotReady(); });
    expect((await page.evaluate(() => window.__SS__!.getState())).render.camera.zoom).toBeCloseTo(2, 3);
    expect(await page.locator('.hud-pin-follower:not([hidden])').first().evaluate(e => getComputedStyle(e).backgroundColor)).toBe('rgb(87, 170, 255)');
    for (const collapsed of [false, true]) {
      if (collapsed) await page.getByTestId('minimap').tap();
      const boxes = await page.evaluate(() => {
        const rect = (id: string) => { const r = document.querySelector(`[data-testid=${id}]`)!.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
        return { map: rect('minimap'), badge: rect('weather-icon'), objective: rect('objective-tracker'), home: rect('home-button'), pause: rect('pause-button'), survivors: document.querySelectorAll('.hud-pin-follower:not([hidden])').length };
      });
      expect(boxes.badge.y).toBeGreaterThan(boxes.map.bottom);
      expect(boxes.objective.y).toBeGreaterThan(boxes.badge.bottom);
      expect(boxes.badge.x + boxes.badge.width / 2).toBeCloseTo(boxes.map.x + boxes.map.width / 2, 0);
      expect(boxes.survivors).toBeGreaterThan(0);
      for (const a of [boxes.map, boxes.badge, boxes.objective]) {
        expect(a.x).toBeGreaterThanOrEqual(0); expect(a.right).toBeLessThanOrEqual(width);
        for (const b of [boxes.home, boxes.pause]) expect(a.right <= b.x || b.right <= a.x || a.bottom <= b.y || b.bottom <= a.y).toBe(true);
      }
      writeFileSync(`${dir}/responsive-${width}-${height}-${collapsed ? 'collapsed' : 'expanded'}.json`, JSON.stringify(boxes, null, 2));
      await page.screenshot({ path: `${dir}/responsive-${width}-${height}-${collapsed ? 'collapsed' : 'expanded'}.png` });
      if (collapsed) await page.getByTestId('minimap').tap();
    }
  }
  await page.evaluate(async () => { window.__SS__!.setLoadout(['weapon.fire-axe'], ['weapon.kick']); await window.__SS__!.step(1); });
  const changing = (await page.evaluate(() => window.__SS__!.getState())).render.camera;
  expect(changing.zoom).toBeGreaterThan(1.5); expect(changing.targetZoom).toBe(1.5);
  await page.evaluate(() => window.__SS__!.step(24));
  expect((await page.evaluate(() => window.__SS__!.getState())).render.camera.zoom).toBeLessThanOrEqual(1.5);
  await page.evaluate(async () => { const a = window.__SS__!; a.setLoadout(['weapon.fire-axe'], ['weapon.rocket-launcher']); await a.step(1); });
  expect((await page.evaluate(() => window.__SS__!.getState())).render.camera.zoomLimits).toEqual([.5, 1.5]);
  await page.evaluate(async () => { const a = window.__SS__!; a.input.set({ selectorSide: 'RIGHT' }); await a.step(1); a.input.clear(); });
  expect((await page.evaluate(() => window.__SS__!.getState())).render.camera.zoomLimits).toEqual([.5, 2]);
});
