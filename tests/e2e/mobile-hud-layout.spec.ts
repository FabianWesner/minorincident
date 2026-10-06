import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from './fixtures';
import { hudStart } from './ui-helpers';

test.use({ hasTouch: true, isMobile: true });
const sizes = [{ width: 412, height: 915 }, { width: 390, height: 844 }, { width: 915, height: 412 }];
const dir = 'test-results/mobile-hud';

for (const scene of ['hud', 'live'] as const) for (const viewport of sizes) {
  test(`@E14 @E14-AC05 @mobile mobile HUD ${scene} ${viewport.width}x${viewport.height}`, async ({ page }, info) => {
    await page.setViewportSize(viewport);
    if (scene === 'hud') await hudStart(page);
    else {
      // Use the deployed entry point, without test mode or injected level/input state.
      await page.goto('/');
      for (const id of ['start-game', 'character-female', 'level-L1', 'mission-button']) await page.getByTestId(id).tap();
      await expect(page.getByTestId('objective-tracker')).toContainText("Go to Joe’s Diner for breakfast");
      await expect(page.getByTestId('corgi-badge')).toBeVisible();
    }
    await expect(page.getByTestId('hud')).toBeVisible();
    await expect(page.getByTestId('touch-left')).toBeVisible();
    const layout = await page.evaluate(() => {
      const visible = (e: HTMLElement) => !!e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden';
      const rect = (e: HTMLElement) => { const r = e.getBoundingClientRect(); return { id: e.dataset.testid ?? e.className, x: r.x, y: r.y, width: r.width, height: r.height }; };
      const roots = [document.querySelector('[data-testid=hud]')!, document.querySelector('[data-testid=touch-controls]')!, document.querySelector('[data-testid=mission-root]')!];
      const elements = [...roots.flatMap(root => [...root.querySelectorAll<HTMLElement>('*')]), document.querySelector<HTMLElement>('[data-testid=pause-button]')!].filter(visible);
      // Include every rendered HUD node, even passive feedback; exclude only structural
      // containers and the transparent, zero-opacity full-screen damage overlay.
      const boxes = elements.filter(e => !['slot-cards', 'vital-bars'].includes(e.dataset.testid ?? '') && !(e.dataset.testid === 'low-health-vignette' && Number(getComputedStyle(e).opacity) === 0)).map(rect);
      const xs = [...new Set(boxes.flatMap(b => [Math.max(0, b.x), Math.min(innerWidth, b.x + b.width)]))].sort((a,b) => a-b);
      let area = 0;
      for (let i = 1; i < xs.length; i++) {
        const intervals = boxes.filter(b => b.x < xs[i] && b.x + b.width > xs[i-1]).map(b => [Math.max(0,b.y), Math.min(innerHeight,b.y+b.height)]).sort((a,b) => a[0]-b[0]);
        let start = 0, end = 0, height = 0;
        for (const [a,b] of intervals) { if (a > end) { height += end-start; start = a; } end = Math.max(end,b); }
        height += end-start; area += (xs[i]-xs[i-1])*height;
      }
      const controls = elements.filter(e => e.matches('button,[role=button]')).map(rect);
      const probe = document.createElement('div'); probe.style.cssText = 'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)'; document.body.append(probe);
      const s = getComputedStyle(probe), safe = { top: parseFloat(s.paddingTop), right: parseFloat(s.paddingRight), bottom: parseFloat(s.paddingBottom), left: parseFloat(s.paddingLeft) }; probe.remove();
      return { coverage: area/(innerWidth*innerHeight), controls, safe, boxes, pause: controls.filter(b => /pause/.test(b.id)).length };
    });
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/${info.project.name}-${scene}-${viewport.width}.json`, JSON.stringify(layout, null, 2));
    await page.screenshot({ path: `${dir}/${info.project.name}-${scene}-${viewport.width}.png` });
    expect(layout.coverage).toBeLessThanOrEqual(viewport.width < viewport.height ? .25 : .20);
    expect(layout.pause).toBe(1);
    for (const [i, a] of layout.controls.entries()) {
      expect(a.width, a.id).toBeGreaterThanOrEqual(44); expect(a.height, a.id).toBeGreaterThanOrEqual(44);
      expect(a.x, a.id).toBeGreaterThanOrEqual(layout.safe.left); expect(a.y, a.id).toBeGreaterThanOrEqual(layout.safe.top);
      expect(a.x+a.width, a.id).toBeLessThanOrEqual(viewport.width-layout.safe.right); expect(a.y+a.height, a.id).toBeLessThanOrEqual(viewport.height-layout.safe.bottom);
      for (const b of layout.controls.slice(i+1)) expect(a.x < b.x+b.width && a.x+a.width > b.x && a.y < b.y+b.height && a.y+a.height > b.y, `${a.id} overlaps ${b.id}`).toBe(false);
    }
    const vitals = await page.getByTestId('vitals').boundingBox();
    expect(vitals!.height).toBeLessThanOrEqual(56);
    if (viewport.width < viewport.height) expect(vitals!.width).toBeLessThanOrEqual(viewport.width*.45);
    const map = await page.getByTestId('minimap').boundingBox(); expect(map!.width).toBeLessThanOrEqual(Math.min(viewport.width,viewport.height)*.28);
    await expect(page.getByTestId('slot-cards')).toBeHidden();
    await page.getByTestId('minimap').tap(); await expect(page.getByTestId('minimap')).toHaveAttribute('aria-expanded','false');
    expect((await page.getByTestId('minimap').boundingBox())!.width).toBeLessThan(map!.width);
    await page.getByTestId('minimap').tap(); await expect(page.getByTestId('minimap')).toHaveAttribute('aria-expanded','true');
    await page.getByTestId('objective-tracker').tap(); await expect(page.getByTestId('objective-detail')).toBeVisible();
    await expect(page.getByTestId('objective-full-text')).toHaveText(await page.getByTestId('objective-tracker').textContent() ?? '');
    await page.getByTestId('objective-close').tap(); await expect(page.getByTestId('objective-detail')).toBeHidden();
    await page.getByTestId('pause-button').tap(); await expect(page.getByTestId('menu-pause')).toBeVisible();
  });
}
