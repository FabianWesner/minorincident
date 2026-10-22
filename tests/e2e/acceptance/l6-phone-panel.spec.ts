import { mkdirSync, writeFileSync } from 'node:fs';
import { readSpec } from '../../../tools/scenelab/session';
import { boot, expect, test } from '../fixtures';

test.use({ isMobile: true, hasTouch: true, deviceScaleFactor: 1, headless: true, launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] } });
for (const backend of ['webgl', 'webgpu'] as const) for (const tier of ['high', 'low'] as const) {
  test(`T-E24-18-phone-panel @E24-AC18 gate prompt clears the phone HUD ${backend} ${tier}`, async ({ page }) => {
    test.setTimeout(300_000);
    await boot(page, `/?test=1&scenelab&ui=1&renderer=${backend}&quality=${tier}&audio=muted&dpr=1`);
    const out = `test-results/ac-close/phone-panel/${backend}-${tier}`;
    mkdirSync(out, { recursive: true });
    const rows: object[] = [], spec = readSpec('tests/scenes/catalog/ui-night-l6-gate.json');
    for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(viewport);
      await page.evaluate(async ({ spec, tier }) => { const a = window.__SS__!; a.settings.set({ quality: tier }); await window.__SCENE__!.load(spec); }, { spec, tier });
      let current = 0;
      for (const frame of [0, 61, 81, 106]) {
        await page.evaluate(n => window.__SCENE__!.step(n), frame - current); current = frame;
        for (const zoom of [.5, 1, 1.5]) {
          await page.evaluate(async ({ camera, zoom }) => { window.__SCENE__!.setCamera({ ...camera, mode: 'game', zoom }); await window.__SS__!.screenshotReady(); }, { camera: spec.camera, zoom });
          await expect(page.getByTestId('interaction-prompt')).toBeVisible();
          const proof = await page.evaluate(() => {
            const panel = document.querySelector<HTMLElement>('[data-testid="interaction-prompt"]')!, p = panel.getBoundingClientRect();
            const obstacles = [...document.querySelectorAll<HTMLElement>('.hud-tracker,.hud-survivor-vitals,.hud-vitals,.hud-map,.hud-weapon-rack,.mission-subtitle,.story-bubble,[data-touch-action]')].flatMap(el => {
              const r = el.getBoundingClientRect(), style = getComputedStyle(el);
              if (!r.width || !r.height || style.visibility === 'hidden' || style.opacity === '0' || el.hidden) return [];
              const overlap = Math.max(0, Math.min(p.right, r.right) - Math.max(p.left, r.left)) * Math.max(0, Math.min(p.bottom, r.bottom) - Math.max(p.top, r.top));
              return [{ name: el.dataset.testid || el.className, rect: r.toJSON(), overlap }];
            });
            const a = window.__SS__!;
            return { panel: p.toJSON(), text: panel.innerText, touch: document.body.classList.contains('touch-ui'), obstacles, backend: a.perf().backend, tier: a.perf().quality.tier };
          });
          rows.push({ viewport, frame, zoom, ...proof });
          writeFileSync(`${out}/proof.json`, JSON.stringify(rows, null, 2));
          await page.screenshot({ path: `${out}/${viewport.width}x${viewport.height}-f${frame}-z${zoom}.png` });
          expect(proof.touch).toBe(true); expect(proof.backend).toBe(backend); expect(proof.tier).toBe(tier);
          expect(proof.panel.x).toBeGreaterThanOrEqual(7.5); expect(proof.panel.y).toBeGreaterThanOrEqual(7.5);
          expect(proof.panel.right).toBeLessThanOrEqual(viewport.width - 7.5); expect(proof.panel.bottom).toBeLessThanOrEqual(viewport.height - 7.5);
          for (const obstacle of proof.obstacles) expect(obstacle.overlap, `${viewport.width}x${viewport.height} f${frame} z${zoom}: ${obstacle.name}`).toBe(0);
        }
      }
    }
  });
}
