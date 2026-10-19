import { mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { test, expect, boot } from '../e2e/fixtures';

const luminance = (r: number, g: number, b: number) => {
  const c = [r, g, b].map(v => v / 255 <= .04045 ? v / 255 / 12.92 : ((v / 255 + .055) / 1.055) ** 2.4);
  return c[0] * .2126 + c[1] * .7152 + c[2] * .0722;
};
test.use({ launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu'] } });
for (const backend of (process.env.READ_BACKENDS ?? 'webgl2,webgpu').split(','))
for (const zoom of (process.env.READ_ZOOMS ?? '0.5,1,1.5').split(',').map(Number))
for (const quality of ['high', 'low'] as const) test(`T-E29-14 @E29-AC14 W6 rocket and horde courier contrast ${quality} ${backend} z${zoom}`, async ({ page }) => {
  test.setTimeout(240_000);
  const out = `test-results/epics/E29/night-${quality}-${backend}-z${zoom}`; mkdirSync(out, { recursive: true });
  await boot(page, `/?test=1&scenelab=1&renderer=${backend === 'webgl2' ? 'webgl' : 'webgpu'}&quality=${quality}&dpr=1&audio=muted`);
  await page.evaluate(async quality => { const a = window.__SS__!; await a.loadLevel('L7', { seed: 29, progression: 'L7-default' }); a.pause(); a.settings.set({ quality }); }, quality);
  for (const [name, spot] of [['rocket', { x: 273, z: 15 }], ['horde', { x: -48, z: 46 }]] as const) {
    const setup = await page.evaluate(async ({ spot, zoom }) => {
      const a = window.__SS__!; a.teleport('player', spot); a.camera.follow(); await a.step(1);
      const p = a.getEntity(1)!.transform;
      const rig = (window.__SCENE__ as unknown as { game: import('../../src/Game').Game }).game.view.view;
      // Snap after the long rocket-to-horde teleport; every measurement uses this spot and zoom.
      rig.reset(p); rig.zoom(Math.log(zoom), true); rig.update(p, 0); await a.screenshotReady();
      const light = ((window.__SCENE__ as unknown as { game: import('../../src/Game').Game }).game.view as unknown as { lighting: import('../../src/render/Lighting').Lighting }).lighting;
      return { grade: { heroRim: light.heroRim?.value, heroRimEdge: light.heroRimEdge?.value, heroSurfaceFill: light.heroSurfaceFill?.value }, backend: a.perf().backend, lighting: a.perf().lighting, ring: Array.from({ length: 16 }, (_, i) => a.camera.project(p.x + 2 * Math.cos(i * Math.PI / 8), p.y - .7, p.z + 2 * Math.sin(i * Math.PI / 8))) };
    }, { spot, zoom });
    const image = PNG.sync.read(await page.locator('canvas').screenshot({ path: `${out}/${name}.png` }));
    await page.evaluate(async () => { const a = window.__SS__!; a.settings.set({ idPass: true }); await a.screenshotReady(); });
    const mask = PNG.sync.read(await page.locator('canvas').screenshot({ path: `${out}/${name}-mask.png` }));
    await page.evaluate(() => window.__SS__!.settings.set({ idPass: false }));
    let sum = 0, pixels = 0, clipped = 0;
    for (let i = 0; i < mask.data.length; i += 4) if (mask.data[i] > 240 && mask.data[i + 1] < 20 && mask.data[i + 2] > 240) { sum += luminance(image.data[i], image.data[i + 1], image.data[i + 2]); pixels++; if (Math.max(image.data[i], image.data[i + 1], image.data[i + 2]) / 255 >= .97) clipped++; }
    const ring = setup.ring.map(p => {
      const x = Math.round((p[0] + 1) * image.width / 2), y = Math.round((1 - p[1]) * image.height / 2), i = (y * image.width + x) * 4;
      return luminance(image.data[i], image.data[i + 1], image.data[i + 2]);
    });
    const contrast = (sum / pixels + .05) / (ring.reduce((a, b) => a + b, 0) / ring.length + .05);
    writeFileSync(`${out}/${name}.json`, JSON.stringify({ pixels, contrast, clippedShare: clipped / pixels, setup }, null, 2));
    expect(clipped / pixels, 'Courier clipped pixel share').toBeLessThanOrEqual(.03);
    expect(pixels).toBeGreaterThan(200); expect(contrast).toBeGreaterThanOrEqual(3);
    expect(setup.backend).toBe(backend === 'webgl2' ? 'webgl' : 'webgpu'); expect(setup.lighting!.preset).toBe('L6'); expect(setup.lighting!.heroLights).toBeLessThanOrEqual(quality === 'high' ? 8 : 3);
  }
});
