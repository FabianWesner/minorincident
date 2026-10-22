import { mkdirSync, writeFileSync } from 'node:fs';
import { boot, expect, test } from '../fixtures';
import { l9Readability } from '../../helpers/l9-readability';
import type { Game } from '../../../src/Game';

test.use({ launchOptions: { args: ['--use-angle=metal', '--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist'] } });
for (const backend of ['webgl', 'webgpu']) for (const quality of ['high', 'low']) {
  test.describe(`${backend}/${quality}`, () => {
    test.use({ isMobile: quality === 'low', hasTouch: quality === 'low' });
  test(`T-E31-16-current-player @E31-AC16 crawl courier and caption clearance ${backend} ${quality}`, async ({ page }) => {
    test.setTimeout(240_000);
    if (quality === 'low') await page.setViewportSize({ width: 390, height: 844 });
    const out = `test-results/epics/E31/player-current-key12/${backend}-${quality}`;
    mkdirSync(out, { recursive: true });
    await boot(page, `/?test=1&scenelab=1&ui=1&renderer=${backend}&quality=${quality}&audio=muted&dpr=1`);
    await page.mouse.click(200, 400);
    for (const hp of [1000, 0]) {
      await page.evaluate(async hp => {
        const a = window.__SS__!; await a.loadLevel('L9', { seed: 31 }); a.pause();
        a.settings.set({ muted: false, captions: true }); await a.audio.unlock();
        const w = (window.__SCENE__ as unknown as { game: Game }).game.world;
        const car = w.vehicles!.cars.get(w.missions!.l9!.state.carId)!;
        car.physics.body.setTranslation({ x: 455, y: 1, z: 0 }, true);
        w.vehicles!.damage(car.entity.id, 1000 - hp); await a.step(1);
      }, hp);
      await page.keyboard.down('KeyW');
      for (let i = 0; i < 12 && await page.evaluate(() => window.__SS__!.getState().l9!.phase === 'driving'); i++) await page.evaluate(() => window.__SS__!.step(60));
      await page.keyboard.up('KeyW');
      expect(await page.evaluate(() => window.__SS__!.getState().l9!.phase)).toBe('approach');
      await page.evaluate(() => window.__SS__!.step(551));
      // Fixed sim stepping does not age the renderer's impact flash. Match
      // the existing real-input helper's one-second render-clock advance.
      await page.evaluate(() => window.__SS__!.vfx.stepRender(1));
      expect(await page.evaluate(() => window.__SS__!.getState().player!.survivor!.scriptedClip)).toBe('crawl');
      for (const zoom of [1, .5, 1.5]) {
        await page.evaluate(async zoom => {
          const game = (window.__SCENE__ as unknown as { game: Game }).game, view = game.view.view;
          view.follow(); view.zoom(Math.log(zoom / view.getState().targetZoom), true); game.view.advance(0);
          await window.__SS__!.screenshotReady();
        }, zoom);
        expect(await page.evaluate(() => window.__SS__!.getState().render.camera.zoom)).toBeCloseTo(zoom, 2);
        // Retain the unchanged strict road measurement too; this focused test
        // only closes the courier subcheck, never the whole navigation AC.
        const proof = await l9Readability(page, `${out}/hp${hp}-z${zoom}`, true);
        expect.soft(proof.playerPixels).toBeGreaterThan(100);
        expect.soft(proof.playerContrast).toBeGreaterThanOrEqual(3);
        const subtitle = await page.getByTestId('mission-subtitle').boundingBox();
        const captions = await page.locator('[data-audio-captions]').boundingBox();
        writeFileSync(`${out}/hp${hp}-z${zoom}-ui.json`, JSON.stringify({ subtitle, captions }, null, 2));
        expect.soft(captions, 'actual crash sound captions are available for layout review').not.toBeNull();
        expect.soft(subtitle, 'actual crawl subtitle is available for layout review').not.toBeNull();
        if (subtitle && captions) expect.soft(subtitle.x < captions.x + captions.width && subtitle.x + subtitle.width > captions.x && subtitle.y < captions.y + captions.height && subtitle.y + subtitle.height > captions.y, 'mission and audio captions must not overlap').toBe(false);
      }
    }
  });
  });
}
