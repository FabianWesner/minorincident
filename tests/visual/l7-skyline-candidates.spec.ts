import { mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import type { Game } from '../../src/Game';
import { boot, test } from '../e2e/fixtures';

/** Presentation exploration only. These overrides are never acceptance proof;
 * the unchanged skyline test must pass after any chosen camera ships. */
test('diagnostic L7 authored skyline camera candidates', async ({ page }) => {
  test.setTimeout(180_000);
  const out = 'test-results/ac-close-l7-l10/skyline-orbit-candidates'; mkdirSync(out, { recursive: true });
  await boot(page, '/?test=1&scenelab=1&renderer=webgl&quality=high&audio=muted&dpr=1');
  await page.evaluate(async () => { const a = window.__SS__!; await a.loadLevel('L7', { seed: 29, progression: 'L7-default' }); a.pause(); });
  const results = [];
  for (const x of [-78.5, 35.805226127876836]) for (const [dx, y, dz, tx] of [[-22, 12, 14, 14], [-22, 18, 24, 14], [-35, 18, 14, 24], [160, 160, 100, -14], [200, 200, 140, -14], [240, 240, 180, -14]]) {
    const pose = { position: [x + dx, y, 47 + dz] as [number, number, number], target: [x + tx, 4, 44] as [number, number, number] };
    const label = `${x < 0 ? 'start' : 'end'}-${dx}-${y}-${dz}`;
    await page.evaluate(async ({ x, pose }) => {
      const a = window.__SS__!, game = (window.__SCENE__ as unknown as { game: Game }).game, w = game.world;
      const departure = w.l7Departure!; departure.state.phase = 'departing';
      Object.assign(w.entities.get(departure.state.busId)!.transform, { x, z: 47 }); a.teleport(1, { x, z: 47 });
      departure.cameraPose = () => pose; game.view.view.cinematic(pose, true);
      a.settings.set({ idPass: false }); await a.screenshotReady();
    }, { x, pose });
    await page.locator('canvas').screenshot({ path: `${out}/${label}.png` });
    await page.evaluate(async () => { const a = window.__SS__!; a.settings.set({ idPass: 'skyline' }); await a.screenshotReady(); });
    const mask = PNG.sync.read(await page.locator('canvas').screenshot({ path: `${out}/${label}-mask.png` }));
    let pixels = 0; for (let i = 0; i < mask.data.length; i += 4) if (mask.data[i] > 240 && mask.data[i + 1] < 20 && mask.data[i + 2] > 240) pixels++;
    results.push({ label, pose, area: pixels / (mask.width * mask.height) });
    writeFileSync(`${out}/candidates.json`, JSON.stringify({ diagnosticOnly: true, results }, null, 2));
  }
});
