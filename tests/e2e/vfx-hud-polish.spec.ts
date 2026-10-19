import { mkdirSync } from 'node:fs';
import { test, expect, boot, testUrl } from './fixtures';

function hudIntersections(selector: string): string[] {
  const a = document.querySelector(selector)!.getBoundingClientRect();
  return [...document.querySelectorAll('.mission-tracker,.mission-minimap,.hud-panel')]
    .filter(el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden' && Number(getComputedStyle(el).opacity) > 0)
    .filter(el => { const b = el.getBoundingClientRect(); return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top; }).map(el => el.className);
}

for (const ui of [false, true]) for (const [width, height] of [[1280, 720], [1920, 1080], [390, 844]]) {
  test(`debug Sound and Controls clear gameplay HUD and letterbox at ${width}x${height} ui=${ui}`, async ({ page }, testInfo) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width, height });
    const backend = testInfo.project.name.endsWith('webgpu') ? 'webgpu' : 'webgl';
    const url = backend === 'webgpu' ? testUrl.replace('&renderer=webgl', '') : testUrl;
    await boot(page, `${url}&scenelab=1&debug=1${ui ? "&ui=1" : ""}`);
    await page.evaluate(async () => {
      const a = window.__SS__!; await a.loadLevel('L6', { seed: 1 }); a.pause(); a.missions.begin(); await a.step(1); await a.screenshotReady();
    });
    expect(await page.evaluate(() => window.__SS__!.getState().render.backend)).toBe(backend);
    for (const cinematic of [false, true]) {
      if (cinematic) {
        await page.evaluate(async () => {
          const a = window.__SS__!;
          for (let i = 0; i < 4; i++) a.missions.completeObjective();
          for (let i = 0; i < 360 && !a.missions.state()!.cinematic; i++) await a.step(1);
          await a.step(1); await a.screenshotReady();
        });
        await expect(page.locator('.mission-ui')).toHaveClass(/is-cinematic/);
      }
      for (const tier of ['high', 'low'] as const) for (const zoom of [1.5, 1, .5]) {
        await page.evaluate(async ({ tier, zoom }) => {
          const a = window.__SS__!; a.debug.renderQuality(tier);
          const p = a.getEntity(1)!.transform; window.__SCENE__!.setCamera({ mode: 'game', target: [p.x, p.z], zoom });
          await a.screenshotReady();
        }, { tier, zoom });
        for (const selector of ['[data-input-controls]', '[data-audio-controls]']) {
          const rect = await page.locator(selector).boundingBox(); expect(rect).not.toBeNull();
          expect(await page.evaluate(hudIntersections, selector)).toEqual([]);
          const clickable = await page.locator(`${selector} summary`).evaluate(summary => {
            const r = summary.getBoundingClientRect();
            return summary.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
          });
          expect(clickable, 'the cinematic letterbox must not cover or clip the summary').toBe(true);
          expect(rect!.y).toBeGreaterThanOrEqual(0); expect(rect!.y + rect!.height).toBeLessThan(44);
        }
        if (cinematic) {
          const subtitle = await page.locator('.mission-subtitle').boundingBox();
          expect(subtitle).not.toBeNull();
          expect(subtitle!.y + subtitle!.height, 'the lower letterbox must not clip subtitles').toBeLessThanOrEqual(height * .9);
        }
        mkdirSync('test-results/vfx-hud-polish', { recursive: true });
        await page.screenshot({ path: `test-results/vfx-hud-polish/hud-${backend}-${width}-${height}-ui${ui}-${tier}-z${zoom}-${cinematic ? 'letterbox' : 'game'}.png` });
      }
      for (const selector of ['[data-input-controls]', '[data-audio-controls]']) {
        await page.locator(selector).evaluate(el => { (el as HTMLDetailsElement).open = true; });
        await page.screenshot({ path: `test-results/vfx-hud-polish/hud-expanded-${backend}-${width}-${height}-ui${ui}-${cinematic ? 'letterbox' : 'game'}-${selector.includes('input') ? 'controls' : 'sound'}.png` });
        expect(await page.evaluate(hudIntersections, selector), 'expanded debug panels reserve space above the HUD').toEqual([]);
        expect(await page.locator(selector).evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'expanded fields fit without horizontal clipping').toBe(true);
        await page.locator(selector).evaluate(el => { (el as HTMLDetailsElement).open = false; });
      }
    }
  });
}

for (const tier of ['high', 'low'] as const) {
  test(`L5 first presented frame and cellar emergence retain the courier ${tier}`, async ({ page }, testInfo) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: 1280, height: 720 });
    const backend = testInfo.project.name.endsWith('webgpu') ? 'webgpu' : 'webgl';
    await boot(page, `${backend === 'webgpu' ? testUrl.replace('&renderer=webgl', '') : testUrl}&scenelab=1`);
    mkdirSync('test-results/vfx-hud-polish', { recursive: true });
    for (const zoom of [1.5, 1, .5]) {
      const initial = await page.evaluate(async ({ tier, zoom }) => {
        const a = window.__SS__!; a.settings.set({ quality: tier });
        await a.loadLevel('L5', { seed: 1 }); a.pause(); a.missions.begin(); a.cheats.god(true);
        const p = a.getEntity(1)!.transform, initial = a.camera.project(p.x, p.y, p.z);
        if (zoom !== 1) for (let i = 0; i < 8; i++) document.querySelector('canvas')!.dispatchEvent(new WheelEvent('wheel', { deltaY: zoom < 1 ? -100 : 100 }));
        await a.step(60); await a.screenshotReady(); return initial;
      }, { tier, zoom });
      expect(Math.abs(initial[0])).toBeLessThan(.8); expect(Math.abs(initial[1])).toBeLessThan(.8);
      expect(await page.evaluate(() => window.__SS__!.getState().render.backend)).toBe(backend);
      expect(await page.evaluate(() => window.__SS__!.getState().render.camera.zoom)).toBeCloseTo(zoom, 2);
      const framing = () => page.evaluate(() => {
        const a = window.__SS__!, p = a.getEntity(1)!.transform;
        return { player: p, focus: a.getState().render.camera.focus, projected: a.camera.project(p.x, p.y, p.z) };
      });
      const before = await framing();
      expect(Math.abs(before.projected[0])).toBeLessThan(.8); expect(Math.abs(before.projected[1])).toBeLessThan(.8);
      await page.screenshot({ path: `test-results/vfx-hud-polish/l5-${backend}-${tier}-z${zoom}-cellar.png` });
      await page.evaluate(async () => { const a = window.__SS__!; a.missions.completeObjective('emerge'); await a.step(1); });
      const first = await framing();
      expect(await page.evaluate(() => window.__SS__!.getState().render.camera.zoom)).toBeCloseTo(zoom, 2);
      // A checkpoint can move the courier across the district in a single tick. Check the first
      // presented pose, before screenshotReady or any settling ticks can hide a stale camera.
      expect(Math.hypot(first.focus[0] - first.player.x, first.focus[2] - first.player.z)).toBeLessThan(.5);
      expect(Math.abs(first.projected[0])).toBeLessThan(.8); expect(Math.abs(first.projected[1])).toBeLessThan(.8);
      await page.evaluate(() => window.__SS__!.screenshotReady());
      await page.screenshot({ path: `test-results/vfx-hud-polish/l5-${backend}-${tier}-z${zoom}-emerged.png` });
    }
  });
}
