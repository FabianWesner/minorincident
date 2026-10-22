import { mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { boot, expect, test } from '../e2e/fixtures';
import type { Game } from '../../src/Game';

const luminance = (r: number, g: number, b: number) => {
  const f = (v: number) => v / 255 <= .04045 ? v / 3294.6 : ((v / 255 + .055) / 1.055) ** 2.4;
  return .2126 * f(r) + .7152 * f(g) + .0722 * f(b);
};
test.use({ launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu'] } });
for (const backend of ['webgl', 'webgpu']) for (const quality of ['high', 'low'] as const) for (const zoom of [.5, 1, 1.5]) {
  test(`T-E30-15-player @E30-AC15 sanctuary, breach and escape player 3:1 ${backend} ${quality} z${zoom}`, async ({ page }) => {
    test.setTimeout(240_000);
    if (quality === 'low') await page.setViewportSize({ width: 390, height: 844 });
    const out = `test-results/epics/E30/readability/${backend}-${quality}-z${zoom}`; mkdirSync(out, { recursive: true });
    await boot(page, `/?test=1&scenelab=1&renderer=${backend}&quality=${quality}&dpr=1&audio=muted`);
    await page.evaluate(async quality => {
      const a = window.__SS__!; await a.loadLevel('L8', { seed: 1, progression: 'L8-default' }); a.pause(); a.cheats.god(true); a.settings.set({ quality }); a.missions.begin();
    }, quality);
    for (const [name, x, z] of [['sanctuary', -60, -20], ['breach', -99, 32], ['escape', 90, 70]] as const) {
      const setup = await page.evaluate(async ({ name, x, z, zoom }) => {
        const a = window.__SS__!, game = (window.__SCENE__ as unknown as { game: Game }).game;
        if (name === 'breach') await a.step(Math.max(1, 3635 - a.getState().tick));
        a.teleport(1, { x, z }); await a.step(1);
        const p = a.getEntity(1)!.transform, rig = game.view.view;
        a.camera.follow(); rig.reset(p); rig.zoom(Math.log(zoom), true); rig.update(p, 0); await a.screenshotReady();
        return { tick: a.getState().tick, phase: a.getState().l8, camera: a.getState().render.camera, backend: a.perf().backend, tier: a.perf().quality.tier,
          ring: Array.from({ length: 16 }, (_, i) => a.camera.project(p.x + 2 * Math.cos(i * Math.PI / 8), p.y - .7, p.z + 2 * Math.sin(i * Math.PI / 8))) };
      }, { name, x, z, zoom });
      const image = PNG.sync.read(await page.locator('canvas').screenshot({ path: `${out}/${name}.png` }));
      await page.evaluate(async () => { window.__SS__!.settings.set({ idPass: true }); await window.__SS__!.screenshotReady(); });
      const mask = PNG.sync.read(await page.locator('canvas').screenshot({ path: `${out}/${name}-mask.png` }));
      await page.evaluate(async () => { window.__SS__!.settings.set({ idPass: false }); await window.__SS__!.screenshotReady(); });
      const inside = (i: number) => mask.data[i] > 240 && mask.data[i + 1] < 20 && mask.data[i + 2] > 240;
      let pixels = 0, sum = 0;
      for (let i = 0; i < mask.data.length; i += 4) if (inside(i)) { pixels++; sum += luminance(image.data[i], image.data[i + 1], image.data[i + 2]); }
      const ring = setup.ring.filter(p => Math.abs(p[0]) < .99 && Math.abs(p[1]) < .99).map(p => (Math.round((1 - p[1]) * image.height / 2) * image.width + Math.round((p[0] + 1) * image.width / 2)) * 4).filter(i => !inside(i)).map(i => luminance(image.data[i], image.data[i + 1], image.data[i + 2]));
      const contrast = (sum / pixels + .05) / (ring.reduce((s, v) => s + v, 0) / ring.length + .05);
      writeFileSync(`${out}/${name}.json`, JSON.stringify({ pixels, contrast, ringSamples: ring.length, ring, setup }, null, 2));
      expect.soft(setup.backend).toBe(backend); expect.soft(setup.tier).toBe(quality);
      expect.soft(pixels).toBeGreaterThan(200); expect.soft(ring.length).toBeGreaterThanOrEqual(8); expect.soft(contrast).toBeGreaterThanOrEqual(3);
    }
  });
}
