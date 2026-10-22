import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect } from '../fixtures';
import { readSpec } from '../../../tools/scenelab/session';
import type { Game } from '../../../src/Game';

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
    for (const name of scenes) {
      const spec = readSpec(`tests/scenes/catalog/l10-q1-${name}.json`);
      await page.evaluate(async spec => {
        const lab = window.__SCENE__!;
        await lab.load({ ...spec, camera: { mode: 'follow', actor: 'courier', zoom: 1 } });
        await lab.step(spec.frames ?? 60); await lab.ready();
      }, spec);
      // Same simulation pose at both zooms. Follow uses the real player rig;
      // a static Scene Lab photo pose has no playerZoom value to assert.
      let baseRadius = 0;
      for (const zoom of [1, .5]) {
        const proof = await page.evaluate(async zoom => {
          const lab = window.__SCENE__!, api = window.__SS__!;
          lab.setCamera({ mode: 'follow', actor: 'courier', zoom });
          // Commit the presentation pose without advancing the simulation.
          (lab as unknown as { game: Game }).game.view.advance(0);
          await lab.ready(); await api.screenshotReady();
          return { state: api.getState(), perf: api.perf() };
        }, zoom);
        await page.locator('canvas').screenshot({ path: `${out}/${name}-z${zoom}.png` });
        writeFileSync(`${out}/${name}-z${zoom}.json`, JSON.stringify(proof, null, 2));
        expect(proof.perf.backend).toBe(backend);
        expect(proof.state.render.quality).toBe(quality);
        expect(proof.state.render.camera.zoom).toBeCloseTo(zoom, 2);
        const camera = proof.state.render.camera;
        if (zoom === 1) baseRadius = camera.radius;
        expect(camera.radius).toBeCloseTo(baseRadius * zoom, 2);
        expect(Math.hypot(...camera.position.map((p, i) => p - camera.target[i]))).toBeCloseTo(camera.radius, 2);
        expect(proof.state.player).not.toBeNull();
      }
    }
    // The full input fixture clears the boss gate with killAll and captures after
    // the front has passed. Use the authored mixed-species scene to inspect the
    // actual expanding mist and collapse sequence without that setup artifact.
    for (const zoom of [1, .5]) {
      const spec = readSpec('tests/scenes/catalog/l10-cure-mist.json');
      await page.evaluate(async ({ spec, zoom }) => {
        await window.__SCENE__!.load({ ...spec, time: 'L10-night', camera: { mode: 'follow', actor: 'courier', zoom } });
        await window.__SCENE__!.ready();
      }, { spec, zoom });
      let previous = 0;
      for (const frame of spec.shots!) {
        const proof = await page.evaluate(async ticks => {
          const lab = window.__SCENE__!, api = window.__SS__!;
          await lab.step(ticks); await lab.ready(); await api.screenshotReady();
          return { state: api.getState(), perf: api.perf() };
        }, frame - previous);
        previous = frame;
        await page.locator('canvas').screenshot({ path: `${out}/mist-z${zoom}-f${frame}.png` });
        writeFileSync(`${out}/mist-z${zoom}-f${frame}.json`, JSON.stringify(proof, null, 2));
        expect(proof.perf.backend).toBe(backend);
        expect(proof.state.player!.health.current).toBeGreaterThan(0);
      }
    }
  });
}
