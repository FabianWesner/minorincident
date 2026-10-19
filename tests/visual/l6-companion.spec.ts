import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect, boot } from '../e2e/fixtures';
import { courierClipping } from './courier-clipping';
import { companionReadability } from './companion-readability';

test.use({ launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu'] } });
for (const backend of (process.env.READ_BACKENDS ?? 'webgl2,webgpu').split(','))
for (const zoom of (process.env.READ_ZOOMS ?? '0.5,1,1.5').split(',').map(Number))
for (const quality of ['high', 'low'] as const) test(`L6 companion outside sodium pool contrast and courier colours ${quality} ${backend} z${zoom}`, async ({ page }) => {
  test.setTimeout(240_000);
  await boot(page, `/?test=1&scenelab=1&renderer=${backend === 'webgl2' ? 'webgl' : 'webgpu'}&quality=${quality}&dpr=1&audio=muted`);
  await page.evaluate(async quality => {
    const a = window.__SS__!; await a.loadLevel('L6', { seed: 1 }); a.pause(); a.settings.set({ quality });
    const game = (window.__SCENE__ as unknown as { game: import('../../src/Game').Game }).game;
    const dog = [...game.world.entities.iterate()].find(e => e.companion)!;
    // Behind the arrival platform's supply-crate pool, beyond the survivor's 2.4 m glow.
    a.teleport(dog.id, { x: game.world.entities.get(1)!.transform.x - 2.8, z: game.world.entities.get(1)!.transform.z + 1 });
    game.view.view.follow(); game.view.view.pull(0, 0, 0);
    for (let i = 0; i < 4; i++) game.view.update(1);
    await a.screenshotReady();
  }, quality);
  await page.addStyleTag({ content: 'body > :not(#game), #game > :not(canvas) { visibility:hidden!important }' });
  await page.evaluate(async zoom => {
    const game = (window.__SCENE__ as unknown as { game: import('../../src/Game').Game }).game;
    const rig = game.view.view, p = window.__SS__!.getEntity(1)!.transform;
    rig.reset(p); rig.zoom(Math.log(zoom), true); rig.update(p, 0);
    await window.__SS__!.screenshotReady();
  }, zoom);
  const courier = await courierClipping(page, `test-results/epics/E24/companion/${quality}-${backend}-z${zoom}`);
  const result = await companionReadability(page);
  const out = 'test-results/epics/E24/companion'; mkdirSync(out, { recursive: true });
  writeFileSync(`${out}/${quality}-${backend}-z${zoom}.json`, JSON.stringify({ ...result, courier }, null, 2));
  await page.locator('canvas').first().screenshot({ path: `${out}/${quality}-${backend}-z${zoom}.png` });
  expect(courier.pixels).toBeGreaterThan(200);
  expect(courier.clippedShare, 'Courier clipped pixel share').toBeLessThanOrEqual(.03);
  expect(await page.evaluate(() => window.__SS__!.perf().backend)).toBe(backend === 'webgl2' ? 'webgl' : 'webgpu');
  expect(result.pixels).toBeGreaterThan(40);
  expect(result.contrast).toBeGreaterThanOrEqual(3);
});
