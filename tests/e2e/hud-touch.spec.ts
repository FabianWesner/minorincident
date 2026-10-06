import { mkdirSync } from 'node:fs';
import { expect, test } from './fixtures';
import { hudStart } from './ui-helpers';
test.use({ hasTouch: true });
test('T-E14-05 @E14 @E14-AC05 portrait/landscape touch targets are 56px and clear of minimap/tracker', async ({ page }) => {
  await hudStart(page);
  await expect(page.getByTestId('touch-stick')).toBeAttached();
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    // Mobile Chromium commits orientation changes on the next compositor frame.
    await expect.poll(() => page.evaluate(() => ({ width: innerWidth, height: innerHeight })), { timeout: 20_000 }).toEqual(viewport);
    await expect(page.getByTestId('touch-controls')).toBeVisible();
    const boxes = await page.evaluate(() => {
      const rect = (element: Element) => { const r = element.getBoundingClientRect(); return { id: (element as HTMLElement).dataset.testid, x: r.x, y: r.y, width: r.width, height: r.height }; };
      return { controls: Array.from(document.querySelectorAll<HTMLElement>('[data-touch-action]:not([hidden]),[data-testid=stick-zone],[data-testid=pause-button],[role=button]')).filter(e => e.getClientRects().length).map(rect), panels: ['minimap', 'objective-tracker'].map(id => rect(document.querySelector(`[data-testid=${id}]`)!)) };
    });
    mkdirSync('test-results/epics/E14', { recursive: true });
    await page.screenshot({ path: `test-results/epics/E14/touch-${viewport.width}.png` });
    for (const box of boxes.controls) {
      expect(box.width, box.id).toBeGreaterThanOrEqual(56); expect(box.height, box.id).toBeGreaterThanOrEqual(56);
      expect(box.x).toBeGreaterThanOrEqual(0); expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width); expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
      for (const other of boxes.controls) { if (box.id === other.id) continue; expect(box.x < other.x + other.width && box.x + box.width > other.x && box.y < other.y + other.height && box.y + box.height > other.y, `${box.id} overlaps ${other.id}`).toBe(false); }
      for (const panel of boxes.panels) { if (box.id === panel.id) continue; expect(box.x < panel.x + panel.width && box.x + box.width > panel.x && box.y < panel.y + panel.height && box.y + box.height > panel.y, `${box.id} overlaps ${panel.id}`).toBe(false); }
    }
  }
});

test('T-E14-touch-slots @E14 @E14-AC01 @E14-AC02 touch actions show equipped icons, cooldown and selected rack', async ({ page }) => {
  await hudStart(page);
  await expect(page.getByTestId('slot-cards')).toBeHidden();
  await expect(page.getByTestId('touch-left')).toHaveClass(/is-selected/);
  const icon = await page.getByTestId('icon-RIGHT').getAttribute('src');
  await expect(page.getByTestId('touch-icon-right')).toHaveAttribute('src', icon!);
  await page.getByTestId('touch-right').tap();
  await page.evaluate(async () => { await window.__SS__!.step(1); });
  await expect(page.getByTestId('touch-right')).toHaveClass(/is-selected/);
  await expect(page.getByTestId('touch-left')).not.toHaveClass(/is-selected/);
  await expect(page.getByTestId('touch-right')).toHaveAttribute('data-charges', await page.getByTestId('stats-RIGHT').getAttribute('data-charges') ?? '');
  expect(await page.getByTestId('touch-right').evaluate(e => Number((e as HTMLElement).style.getPropertyValue('--progress')))).toBeLessThan(1);
  await page.getByTestId('touch-selector').tap();
  await page.evaluate(async () => { await window.__SS__!.step(1); });
  await expect(page.getByTestId('touch-icon-right')).toHaveAttribute('src', (await page.getByTestId('icon-RIGHT').getAttribute('src'))!);
  expect(await page.getByTestId('touch-icon-right').getAttribute('src')).not.toBe(icon);
});
