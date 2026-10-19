import { mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { test, expect, boot } from '../e2e/fixtures';
import { courierFrames, courierColourStats, colourFailures } from './courier-colours';

/** QA #28 (verbatim): "Courier lighting blowout: bleached pale white at night in L5 (tick 6858, 36.46,41.23, high z0.5;
 * survivors too), neon yellow-green in the L6 shelter light shaft (tick 142, 0.33,3.56)." Both survivors keep their
 * daylight colours (same pose/camera with the L2 preset) and never clip. */
test.use({ launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu'] } });
const spots = [['L5', { x: 36.46, z: 41.23 }], ['L6', { x: .33, z: 3.56 }]] as const;
for (const backend of (process.env.READ_BACKENDS ?? 'webgl2,webgpu').split(','))
for (const quality of ['high', 'low'] as const)
for (const [level, at] of spots) test(`courier night colours QA28 ${level} ${quality} ${backend}`, async ({ page }) => {
  test.setTimeout(240_000);
  const out = `test-results/epics/E25/courier-colours/${level}-${quality}-${backend}`; mkdirSync(out, { recursive: true });
  await boot(page, `/?test=1&scenelab=1&renderer=${backend === 'webgl2' ? 'webgl' : 'webgpu'}&quality=${quality}&dpr=1&audio=muted`);
  await page.evaluate(async ({ level, quality }) => { const a = window.__SS__!; await a.loadLevel(level, { seed: 1 }); a.pause(); a.cheats.god(true); a.settings.set({ quality, cameraShake: false }); }, { level, quality });
  await page.addStyleTag({ content: 'body > :not(#game), #game > :not(canvas) { visibility:hidden!important }' });
  for (const variant of ['female', 'male'] as const) for (const zoom of [.5, 1]) {
    await page.evaluate(async ({ at, zoom, variant }) => {
      const a = window.__SS__!, game = (window.__SCENE__ as unknown as { game: import('../../src/Game').Game }).game;
      game.world.entities.get(1)!.survivor!.variant = variant;
      a.teleport('player', at); a.camera.follow(); await a.step(1);
      const p = a.getEntity(1)!.transform, rig = game.view.view;
      rig.reset(p); rig.zoom(Math.log(zoom), true); rig.update(p, 0);
      for (let i = 0; i < 4; i++) game.view.update(1);
      await a.screenshotReady();
    }, { at, zoom, variant });
    const { image, mask, day } = await courierFrames(page);
    writeFileSync(`${out}/${variant}-z${zoom}.png`, PNG.sync.write(image));
    let pixels = 0, clipped = 0;
    for (let i = 0; i < mask.data.length; i += 4) if (mask.data[i] > 240 && mask.data[i + 1] < 20 && mask.data[i + 2] > 240) { pixels++; if (Math.max(image.data[i], image.data[i + 1], image.data[i + 2]) / 255 >= .97) clipped++; }
    const night = courierColourStats(image, day, mask), daylight = courierColourStats(day, day, mask), failures = colourFailures(night, daylight);
    writeFileSync(`${out}/${variant}-z${zoom}.json`, JSON.stringify({ pixels, clippedShare: clipped / pixels, night, daylight, failures }, null, 2));
    expect(pixels, `${variant} z${zoom} courier pixels`).toBeGreaterThan(200);
    expect(clipped / pixels, `${variant} z${zoom} clipped courier pixels`).toBeLessThanOrEqual(.03);
    expect(failures, `${variant} z${zoom} courier keeps her daylight colours`).toEqual([]);
  }
});
