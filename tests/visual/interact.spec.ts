import { mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { boot, expect, test } from '../e2e/fixtures';
const output = 'test-results/epics/E11';
const luminance = (rgb: number[]) => rgb.map(c => c / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4).reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0);
for (const mobile of [false, true]) {
  test(`T-E11-09-${mobile ? 'mobile' : 'desktop'} @E11 @E11-AC09 @visual interact-ui is readable above world at every tier`, async ({ page }) => {
    test.setTimeout(300_000); mkdirSync(output, { recursive: true });
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await boot(page); const metrics = [];
    for (const tier of [0, 1, 2, 3, 4, 5] as const) {
      const point = await page.evaluate(async tier => {
        const api = window.__SS__!; await api.loadLevel('D-RES', { tier, seed: 1 }); api.pause();
        const p = api.getState().player!.transform;
        const id = api.spawn('device.generator', { x: p.x, z: p.z + 1 }, { holdTime: 4, fuel: 20, label: 'Start generator' });
        await api.step(90); api.camera.preset('interact-ui'); await api.screenshotReady();
        const e = api.getEntity(id)!;
        return { id, progress: e.interactable!.progress, ndc: api.camera.project(e.transform.x, .05, e.transform.z), perf: api.perf() };
      }, tier);
      const panel = page.getByTestId('interaction-prompt'); await expect(panel).toBeVisible();
      await expect(panel).toContainText('Start generator'); await expect(panel).toContainText('E / middle-click');
      await expect(panel.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '38');
      expect(point.progress).toBeCloseTo(.375);
      const style = await panel.evaluate(el => {
        const s = getComputedStyle(el), bounds = el.getBoundingClientRect();
        return { color: s.color, background: s.backgroundColor, fontSize: parseFloat(s.fontSize), bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }, zIndex: Number(s.zIndex) };
      });
      const parse = (s: string) => s.match(/\d+/g)!.slice(0, 3).map(Number);
      const contrast = (luminance(parse(style.color)) + .05) / (luminance(parse(style.background)) + .05);
      expect(contrast).toBeGreaterThan(7); expect(style.fontSize).toBeGreaterThanOrEqual(16); expect(style.zIndex).toBeGreaterThan(0);
      const viewport = page.viewportSize()!;
      expect(style.bounds.x).toBeGreaterThanOrEqual(0); expect(style.bounds.y).toBeGreaterThanOrEqual(0);
      expect(style.bounds.x + style.bounds.width).toBeLessThanOrEqual(viewport.width);
      const buffer = await page.screenshot({ path: `${output}/interact-ui-W${tier}-${mobile ? 'mobile' : 'desktop'}.png` });
      const image = PNG.sync.read(buffer), cx = (point.ndc[0] + 1) * image.width / 2, cy = (1 - point.ndc[1]) * image.height / 2;
      let teal = 0;
      for (let y = Math.max(0, Math.floor(cy - 90)); y < Math.min(image.height, cy + 90); y++) for (let x = Math.max(0, Math.floor(cx - 120)); x < Math.min(image.width, cx + 120); x++) {
        if (x >= style.bounds.x && x <= style.bounds.x + style.bounds.width && y >= style.bounds.y && y <= style.bounds.y + style.bounds.height) continue;
        const i = (y * image.width + x) * 4;
        if (image.data[i] < 200 && image.data[i + 1] > 180 && image.data[i + 2] > 130) teal++;
      }
      expect(teal, 'visible progress ring outside the DOM prompt').toBeGreaterThan(20);
      metrics.push({ tier, contrast, teal, ...style, perf: point.perf });
    }
    writeFileSync(`${output}/ui-${mobile ? 'mobile' : 'desktop'}-metrics.json`, JSON.stringify(metrics, null, 2) + '\n');
  });
}
