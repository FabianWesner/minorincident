import { mkdirSync, writeFileSync } from 'node:fs';
import type { Game } from '../../../src/Game';
import { test, expect, boot } from '../fixtures';

const output = 'test-results/l8-continuity';
test.use({ trace: 'off' });

for (const quality of ['high', 'low'] as const) test(`@E30-AC03 courier outfit and gear persist across L1–L10 for both heroines, ${quality}`, async ({ page }) => {
  test.setTimeout(600_000); page.setDefaultTimeout(120_000); mkdirSync(output, { recursive: true });
  await boot(page, `/?test=1&scenelab=1&renderer=webgl&dpr=1&quality=${quality}&audio=muted&seed=1&ui=1`);
  const evidence = [];
  for (let level = 1; level <= 10; level++) {
    await page.evaluate(async ({ level, quality }) => {
      const a = window.__SS__!; a.settings.set({ quality });
      await a.loadLevel(`L${level}`, { seed: 1 }); a.pause(); a.settings.set({ quality });
      const game = (window.__SCENE__ as unknown as { game: Game }).game;
      if (game.world.missions?.state.phase === 'briefing') game.world.missions.begin();
    }, { level, quality });
    expect(await page.evaluate(() => window.__SS__!.getState().render.quality)).toBe(quality);
    if (level > 1) expect(await page.evaluate(() => window.__SS__!.getState().render.camera.targetZoom)).toBe(1.5);
    for (const variant of ['female', 'male'] as const) {
      for (const tier of [0, 1, 2, 3, 4] as const) {
        const state = await page.evaluate(async ({ variant, tier }) => {
          const a = window.__SS__!; a.survivor.select(variant, tier); await a.screenshotReady();
          return a.getState().render.character!;
        }, { variant, tier });
        expect(state.modelId).toBe(`char.courier-${variant}.skin`);
        expect(state.sources.find(s => s.variant === variant)?.source).toBe('glb');
        expect(state.gearTier).toBe(tier);
        // Real fitted gear is not yet shipped. Never reintroduce placeholder armor between levels.
        expect(state.gearMeshes).toEqual([]);
        evidence.push({ level, quality, variant, tier, model: state.modelId, gear: state.gearMeshes, skinned: state.skinned });
      }
      if (level >= 7) {
        await page.evaluate(async () => {
          const a = window.__SS__!, game = (window.__SCENE__ as unknown as { game: Game }).game;
          const player = game.world.entities.get(1)!;
          // The L9 driver is normally concealed inside the APC. A paused outfit portrait
          // places her beside it; asset/gear assertions above use the actual loaded start.
          if (game.world.scenario === 'L9' && game.world.vehicles?.active != null) {
            const vehicles = game.world.vehicles, car = vehicles.cars.get(vehicles.active!)!;
            vehicles.active = null; vehicles.transition = null; car.entity.vehicle!.driver = null;
            a.teleport('player', { x: player.transform.x, z: player.transform.z + 8 });
          }
          player.hidden = false;
          const p = player.transform;
          a.camera.cinematic({ position: [p.x + 3.5, p.y + 2, p.z + 4], target: [p.x, p.y + .3, p.z] }, true);
          await a.screenshotReady();
        });
        await page.screenshot({ path: `${output}/${quality}-L${level}-${variant}-tier4.png` });
      }
    }
    const guidance = await page.evaluate(() => {
      const a = window.__SS__!, p = a.getState().player!.transform;
      a.camera.cinematic({ position: [p.x + 10, p.y + 10, p.z + 10], target: [p.x, p.y, p.z] }, true);
      const game = (window.__SCENE__ as unknown as { game: Game }).game; game.view.update(1);
      return { ring: a.getState().render.missionMarker?.visible, arrow: document.querySelector<HTMLElement>('[data-testid=mission-marker]')?.hidden };
    });
    expect(guidance.ring).toBe(false); expect(guidance.arrow).toBe(true);
    // Both a scripted camera preset and the next load must retain this preference.
    await page.evaluate(() => {
      const game = (window.__SCENE__ as unknown as { game: Game }).game;
      game.view.view.follow(); game.view.advance(1);
      game.view.view.zoom(Math.log(1.5 / game.view.view.getState().targetZoom), true); game.view.advance(0);
    });
    if (level < 10) {
      // Checked immediately after the next load below; level reset owns camera pose, not the preference.
      expect(await page.evaluate(() => window.__SS__!.getState().render.camera.targetZoom)).toBe(1.5);
    }
  }
  writeFileSync(`${output}/${quality}-courier-assets.json`, JSON.stringify(evidence, null, 2));
});
