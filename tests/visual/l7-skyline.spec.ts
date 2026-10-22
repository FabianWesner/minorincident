import { mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import type { Game } from '../../src/Game';
import { l7Departure } from '../../src/data/l7';
import { boot, expect, test } from '../e2e/fixtures';

for (const backend of ['webgl', 'webgpu']) for (const quality of ['high', 'low'] as const) {
  test(`T-E29-13-skyline @E29-AC13 visible building area recedes before the fade ${backend} ${quality}`, async ({ page }) => {
    test.setTimeout(240_000);
    const out = `test-results/epics/E29/skyline-${backend}-${quality}`; mkdirSync(out, { recursive: true });
    await boot(page, `/?test=1&scenelab=1&renderer=${backend}&quality=${quality}&audio=muted&dpr=1`);
    await page.evaluate(async quality => {
      const a = window.__SS__!;
      await a.loadLevel('L7', { seed: 29, progression: 'L7-default' }); a.pause(); a.missions.begin(); a.settings.set({ quality });
      // Isolate the production shot. Boarding/roster continuity is exercised by
      // T-E29-13-board and the continuous real-input route, without this setup.
      const w = (window.__SCENE__ as unknown as { game: Game }).game.world;
      const departure = w.l7Departure!;
      a.teleport(1, { x: -70.5, z: 47.5 }); a.camera.follow();
      (window.__SCENE__ as unknown as { game: Game }).game.view.view.reset(a.getEntity(1)!.transform);
      for (const r of w.l7Encounters!.state.roster.filter(r => r.status === 'following')) {
        const e = w.entities.get(r.id)!; e.hidden = true; e.passengerOf = departure.state.busId; w.spatial.delete(e.id);
        departure.state.boarded.push(e.id);
      }
      (departure as unknown as { depart(): void }).depart();
    }, quality);
    const frames = [];
    for (const [name, elapsed] of [['start', 0], ['end', l7Departure.fadeAtSeconds * 60 - 1]] as const) {
      const state = await page.evaluate(async elapsed => {
        const a = window.__SS__!, w = (window.__SCENE__ as unknown as { game: Game }).game.world;
        // Advance the real fixed-tick camera blend/drive, stopping before the
        // fade and automatic handover. No scene tick or bus pose is overwritten.
        while (w.tick - w.l7Departure!.state.startedAt < elapsed) await a.step(1);
        a.settings.set({ idPass: false }); await a.screenshotReady();
        return { tick: w.tick, elapsed, fade: w.l7Departure!.fading, bus: { ...w.entities.get(w.l7Departure!.state.busId)!.transform }, camera: a.getState().render.camera, backend: a.getState().render.backend, quality: a.getState().render.quality };
      }, elapsed);
      await page.locator('canvas').screenshot({ path: `${out}/${name}.png` });
      await page.evaluate(async () => { const a = window.__SS__!; a.settings.set({ idPass: 'skyline' }); await a.screenshotReady(); });
      const mask = PNG.sync.read(await page.locator('canvas').screenshot({ path: `${out}/${name}-mask.png` }));
      let pixels = 0;
      for (let i = 0; i < mask.data.length; i += 4) if (mask.data[i] > 240 && mask.data[i + 1] < 20 && mask.data[i + 2] > 240) pixels++;
      frames.push({ name, ...state, pixels, area: pixels / (mask.width * mask.height), width: mask.width, height: mask.height });
      writeFileSync(`${out}/area.json`, JSON.stringify({ definition: 'Visible bld.* geometry pixels / full canvas; production placement/depth, no postprocessing, before black fade', frames }, null, 2));
      expect(state.fade).toBe(false); expect(state.backend).toBe(backend); expect(state.quality).toBe(quality);
    }
    expect(frames[0].area).toBeGreaterThanOrEqual(.25);
    expect(frames[1].area).toBeLessThanOrEqual(.10);
    expect(Math.hypot(frames[1].bus.x - frames[0].bus.x, frames[1].bus.z - frames[0].bus.z)).toBeGreaterThanOrEqual(30);
    expect(l7Departure.seconds).toBeGreaterThanOrEqual(6); expect(l7Departure.seconds).toBeLessThanOrEqual(10);
  });
}
