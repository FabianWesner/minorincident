import { mkdirSync, writeFileSync } from 'node:fs';
import { devices, type Page } from '@playwright/test';
import type { Game } from '../../../src/Game';
import { boot, expect, test } from '../fixtures';

const backend = process.env.FIXES_BACKEND === 'webgpu' ? 'webgpu' : 'webgl2';
const out = 'docs/reports/fixes-13h-flow';
if (backend === 'webgpu') test.use({ launchOptions: { args: ['--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=metal'] } });
test.use({ trace: 'off' });

async function boarded(page: Page, quality: 'high' | 'low') {
  await boot(page, `/?test=1&scenelab=1&debug=1&ui=1&dpr=1&audio=muted&quality=${quality}${backend === 'webgl2' ? '&renderer=webgl' : ''}`);
  await page.evaluate(async quality => {
    const a = window.__SS__!;
    await a.loadLevel('L8', { seed: 1, progression: 'L8-default' });
    a.pause(); a.missions.begin(); a.settings.set({ quality });
    const w = (window.__SCENE__ as unknown as { game: Game }).game.world;
    a.teleport(1, w.missions!.l8!.door()); await a.step(1); a.camera.follow();
  }, quality);
  await page.keyboard.down('e'); await page.evaluate(() => window.__SS__!.step(2)); await page.keyboard.up('e');
  await expect(page.getByTestId('vehicle-durability')).toBeVisible();
  await expect(page.getByTestId('objective-text')).toContainText('Wait for the breach');
  await expect(page.getByTestId('objective-text')).not.toContainText(/\b0\s*m\b/);
  expect(await page.evaluate(() => window.__SS__!.getState().render.backend)).toBe(backend === 'webgl2' ? 'webgl' : 'webgpu');
}

async function layout(page: Page, zoom: number) {
  await page.evaluate(async zoom => {
    const g = (window.__SCENE__ as unknown as { game: Game }).game;
    g.view.view.zoom(Math.log(zoom / g.view.view.playerZoom), true);
    g.view.view.update(g.world.entities.get(1)!.transform, 0);
    await window.__SS__!.step(1); await window.__SS__!.screenshotReady();
  }, zoom);
  const boxes = await page.evaluate(() => {
    const rect = (id: string) => { const r = document.querySelector<HTMLElement>(`[data-testid=${id}]`)!.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom }; };
    const companion = document.body.classList.contains('touch-ui') ? 'corgi-badge' : 'corgi-companion';
    return { companion: rect(companion), armor: rect('vehicle-durability'), hud: document.querySelector('[data-testid=objective-text]')!.textContent };
  });
  const { companion: c, armor: a } = boxes;
  expect(c.right <= a.x || a.right <= c.x || c.bottom + 4 <= a.y || a.bottom + 4 <= c.y, JSON.stringify(boxes)).toBe(true);
  expect(a.bottom).toBeLessThanOrEqual(page.viewportSize()!.height);
  return boxes;
}

for (const quality of ['high', 'low'] as const) {
  test(`#97 APC countdown and separate companion/Armor panels at every zoom, ${quality}`, async ({ page }) => {
    test.setTimeout(180_000); await boarded(page, quality);
    const rows = [];
    for (const zoom of [.5, 1, 1.5]) {
      rows.push({ zoom, ...await layout(page, zoom) });
      if (zoom !== 1) { mkdirSync(out, { recursive: true }); await page.screenshot({ path: `${out}/${backend}-${quality}-z${zoom}.png` }); }
    }
    mkdirSync('test-results/fixes-13h-flow', { recursive: true });
    writeFileSync(`test-results/fixes-13h-flow/layout-${backend}-${quality}.json`, JSON.stringify(rows, null, 2));
  });
}

test.describe('phone landscape', () => {
  test.use({ hasTouch: true, isMobile: true, userAgent: devices['Pixel 7 landscape'].userAgent, viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
  test('#97 companion badge and Armor remain separate on phone landscape', async ({ page }) => {
    test.setTimeout(180_000); await boarded(page, 'low');
    for (const zoom of [.5, 1, 1.5]) await layout(page, zoom);
    await page.screenshot({ path: 'test-results/fixes-13h-flow/phone-landscape.png' });
  });
});
