import { mkdirSync, writeFileSync } from 'node:fs';
import { readSpec } from '../../tools/scenelab/session';
import { boot, expect, test } from './fixtures';

for (const backend of ['webgl', 'webgpu'] as const) for (const tier of ['high', 'low'] as const) {
  test(`@E26-AC16 @E24 interaction panel stays inside all viewport edges ${backend} ${tier}`, async ({ page }) => {
    test.setTimeout(300_000);
    await boot(page, `/?test=1&scenelab&renderer=${backend}&quality=${tier}&audio=muted&dpr=1`);
    const out = `test-results/ui-night/panels/${backend}-${tier}`;
    mkdirSync(out, { recursive: true });
    const results = [];
    for (const viewport of [{ width: 1600, height: 900 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(viewport);
      for (const name of ['barricade-W0', 'barricade-W5', 'l6-gate']) {
        const spec = readSpec(`tests/scenes/catalog/ui-night-${name}.json`);
        await page.evaluate(async ({ spec, tier }) => { window.__SS__!.settings.set({ quality: tier }); await window.__SCENE__!.load(spec); }, { spec, tier });
        expect(await page.evaluate(() => window.__SS__!.perf().quality.tier)).toBe(tier);
        // State changes can change caption wrapping and hide the coverage meter.
        let current = 0;
        for (const frame of name === 'l6-gate' ? [0, 61, 81, 106] : [0, 90, 101, 116]) {
          await page.evaluate(async frames => { if (frames > 0) await window.__SCENE__!.step(frames); }, frame - current);
          current = frame;
          if (name === 'l6-gate' && frame > 0) {
            const gate = await page.evaluate(() => window.__SS__!.barricades.slots().find(s => s.state.slot.id === 'l6-gate-90')!);
            expect(gate.state.intact).toBe(frame < 100);
          }
          for (const zoom of [.5, 1, 1.5]) {
            await page.evaluate(async ({ zoom, camera }) => {
              window.__SCENE__!.setCamera({ ...camera, mode: 'game', zoom });
              await window.__SS__!.screenshotReady();
            }, { zoom, camera: spec.camera });
            const panel = page.getByTestId('interaction-prompt');
            // A full, braced barricade has no active repair interaction.
            if (name !== 'l6-gate' && frame === 90) {
              expect(await page.evaluate(() => window.__SS__!.barricades.intact('door'))).toBe(true);
              await expect(panel).toBeHidden();
              await page.screenshot({ path: `${out}/${name}-${viewport.width}x${viewport.height}-f${frame}-z${zoom}.png` });
              continue;
            }
            await expect(panel).toBeVisible();
            const rect = await panel.boundingBox(); expect(rect).not.toBeNull();
            expect(rect!.x).toBeGreaterThanOrEqual(7.5); expect(rect!.y).toBeGreaterThanOrEqual(7.5);
            expect(rect!.x + rect!.width).toBeLessThanOrEqual(viewport.width - 7.5);
            expect(rect!.y + rect!.height).toBeLessThanOrEqual(viewport.height - 7.5);
            results.push({ viewport, name, frame, zoom, rect, text: await panel.innerText() });
            await page.screenshot({ path: `${out}/${name}-${viewport.width}x${viewport.height}-f${frame}-z${zoom}.png` });
          }
        }
      }
    }
    expect(await page.evaluate(() => window.__SS__!.perf().backend)).toBe(backend);
    writeFileSync(`${out}/bounds.json`, JSON.stringify(results, null, 2));
  });
}
