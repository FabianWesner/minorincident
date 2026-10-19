import { mkdirSync } from 'node:fs';
import { test, expect, boot, testUrl } from './fixtures';

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
        });
        await expect(page.locator('.mission-ui')).toHaveClass(/is-cinematic/);
      }
      for (const tier of ['high', 'low'] as const) for (const zoom of [1, .5]) {
        await page.evaluate(async ({ tier, zoom }) => {
          const a = window.__SS__!; a.debug.renderQuality(tier);
          const p = a.getEntity(1)!.transform; window.__SCENE__!.setCamera({ mode: 'game', target: [p.x, p.z], zoom });
          await a.screenshotReady();
        }, { tier, zoom });
        for (const selector of ['[data-input-controls]', '[data-audio-controls]']) {
          const rect = await page.locator(selector).boundingBox(); expect(rect).not.toBeNull();
          const overlaps = await page.evaluate(({ selector }) => {
            const a = document.querySelector(selector)!.getBoundingClientRect();
            return [...document.querySelectorAll('.mission-tracker,.mission-minimap,.hud-panel')]
              .filter(el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden')
              .filter(el => { const b = el.getBoundingClientRect(); return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top; }).map(el => el.className);
          }, { selector });
          expect(overlaps).toEqual([]);
          const clickable = await page.locator(`${selector} summary`).evaluate(summary => {
            const r = summary.getBoundingClientRect();
            return summary.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
          });
          expect(clickable, 'the cinematic letterbox must not cover or clip the summary').toBe(true);
          expect(rect!.y).toBeGreaterThanOrEqual(0); expect(rect!.y + rect!.height).toBeLessThan(44);
        }
        mkdirSync('test-results/vfx-hud-polish', { recursive: true });
        await page.screenshot({ path: `test-results/vfx-hud-polish/hud-${backend}-${width}-${height}-ui${ui}-${tier}-z${zoom}-${cinematic ? 'letterbox' : 'game'}.png` });
      }
    }
  });
}
