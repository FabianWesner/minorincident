import { mkdirSync } from 'node:fs';
import { expect, test } from './fixtures';
import { hudStart } from './ui-helpers';
test.use({ hasTouch: true });
test('T-E14-05 @E14 @E14-AC05 portrait/landscape touch targets are 56px and clear of minimap/tracker', async ({ page }) => {
  await hudStart(page);
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    await expect(page.getByTestId('touch-controls')).toBeVisible();
    const boxes = await page.evaluate(() => {
      const rect = (element: Element) => { const r = element.getBoundingClientRect(); return { id: (element as HTMLElement).dataset.testid, x: r.x, y: r.y, width: r.width, height: r.height }; };
      return { controls: Array.from(document.querySelectorAll('[data-touch-action]:not([hidden]),[data-testid=stick-zone],[data-testid=pause-button]')).map(rect), panels: ['minimap', 'objective-tracker'].map(id => rect(document.querySelector(`[data-testid=${id}]`)!)) };
    });
    mkdirSync('test-results/epics/E14', { recursive: true });
    await page.screenshot({ path: `test-results/epics/E14/touch-${viewport.width}.png` });
    for (const box of boxes.controls) {
      expect(box.width, box.id).toBeGreaterThanOrEqual(56); expect(box.height, box.id).toBeGreaterThanOrEqual(56);
      expect(box.x).toBeGreaterThanOrEqual(0); expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width); expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
      for (const panel of boxes.panels) expect(box.x < panel.x + panel.width && box.x + box.width > panel.x && box.y < panel.y + panel.height && box.y + box.height > panel.y, `${box.id} overlaps ${panel.id}`).toBe(false);
    }
  }
});
