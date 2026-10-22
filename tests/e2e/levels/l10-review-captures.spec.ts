import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect } from '../fixtures';
import { readSpec } from '../../../tools/scenelab/session';

// Evidence collection is not a scored vision pass. Review the saved game-camera pairs.
test.use({ launchOptions: { args: ['--use-angle=metal', '--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist'] } });
const scenes = ['r1-crash', 'r2-residential', 'r3-industrial', 'r4-military', 'r5-research', 'r6-corridor', 'r7-dispersal'];
for (const backend of ['webgl', 'webgpu'] as const) for (const quality of ['high', 'low'] as const) {
  test(`T-E32-30-current-regions @E32-AC30 seven production region pairs ${backend} ${quality}`, async ({ page }) => {
    test.setTimeout(300_000);
    const out = `test-results/epics/E32/current-review/${backend}-${quality}`;
    mkdirSync(out, { recursive: true });
    await page.goto(`/?test=1&scenelab&renderer=${backend}&quality=${quality}&audio=muted&dpr=1`);
    await page.waitForFunction(() => !!window.__SCENE__ && !!window.__SS__);
    await page.evaluate(() => window.__SS__!.ready);
    for (const name of scenes) for (const zoom of [1, .5]) {
      const spec = readSpec(`tests/scenes/catalog/l10-q1-${name}.json`);
      const proof = await page.evaluate(async ({ spec, zoom }) => {
        const lab = window.__SCENE__!, api = window.__SS__!;
        await lab.load({ ...spec, camera: { ...spec.camera!, zoom } as typeof spec.camera });
        await lab.step(spec.frames ?? 60); await lab.ready(); await api.screenshotReady();
        return { state: api.getState(), perf: api.perf() };
      }, { spec, zoom });
      await page.locator('canvas').screenshot({ path: `${out}/${name}-z${zoom}.png` });
      writeFileSync(`${out}/${name}-z${zoom}.json`, JSON.stringify(proof, null, 2));
      expect(proof.perf.backend).toBe(backend);
      expect(proof.state.render.quality).toBe(quality);
      expect(proof.state.render.camera.zoom).toBeCloseTo(zoom, 2);
      expect(proof.state.player).not.toBeNull();
    }
  });
}
