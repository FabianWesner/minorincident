import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { boot, expect, test, testUrl } from './fixtures';
import { canvasFrame, canvasFrameChecks } from './canvas-frame';
import type { SceneSpec } from '../../src/debug/scenelab/spec';
import { readSpec } from '../../tools/scenelab/session';

test.use({ launchOptions: { args: process.platform === 'darwin'
  ? ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-unsafe-webgpu']
  : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu'] } });

for (const tier of ['high', 'low'] as const) {
  for (const backend of ['webgl', 'webgpu']) test(`Scene Lab reload isolates courier gear ${backend} ${tier}`, async ({ page }) => {
    test.setTimeout(180_000);
    await boot(page, `${testUrl.replace('renderer=webgl', `renderer=${backend}`).replace('quality=high', `quality=${tier}`)}&scenelab=1`);
    const geared = readSpec('tests/scenes/catalog/seethrough-gear-four.json'), gate = readSpec('tests/scenes/catalog/seethrough-door-gate.json');
    const result = await page.evaluate(async ({ geared, gate }) => {
      const lab = window.__SCENE__!, api = window.__SS__!;
      await lab.load(geared); await lab.ready();
      const before = api.getState().render.character!.gearTier;
      await lab.load(gate); await lab.step(250); await lab.ready();
      return { before, after: api.getState().render.character!.gearTier, draws: (await lab.metrics()).perf.drawCalls.max, backend: api.perf().backend };
    }, { geared, gate });
    expect(result.backend).toBe(backend); expect(result.before).toBe(4); expect(result.after).toBe(0); expect(result.draws).toBeLessThanOrEqual(33); // 30 + 3 ambient-life meshes (atmosphere, 10-18)
  });
  test(`T-E02-webgpu-canvas @smoke @E02 WebGPU ${tier} mega health bars preserve the game frame at both zoom limits`, async ({ page }) => {
    test.setTimeout(180_000);
    await boot(page, `${testUrl.replace('renderer=webgl', 'renderer=webgpu').replace('quality=high', `quality=${tier}`)}&scenelab=1`);
    expect(await page.evaluate(() => window.__SS__!.perf().backend)).toBe('webgpu');
    const spec = JSON.parse(readFileSync('tests/scenes/l10-mega-moves/l10-mega-slam.json', 'utf8')) as SceneSpec;
    for (const zoom of [1, .5]) {
      await page.evaluate(async ({ spec, zoom }) => {
        await window.__SCENE__!.load({ ...spec, camera: { ...spec.camera!, zoom } as SceneSpec['camera'] });
        await window.__SCENE__!.step(60);
      }, { spec, zoom });
      const pixels = await canvasFrame(page);
      if (zoom === 1) expect(await page.evaluate(() => window.__SS__!.getState().render.healthBars!.count), 'Visible Mega bar exercises canvas compositing').toBeGreaterThan(0);
      expect(canvasFrameChecks(pixels).filter(c => !c.pass), `${tier} zoom ${zoom}: ${JSON.stringify(pixels)}`).toEqual([]);
    }
  });

  test(`T-E02-webgpu-game-canvas @smoke @E02 WebGPU ${tier} L1 L4 L8 game cameras render at both zoom limits`, async ({ page }) => {
    test.setTimeout(300_000);
    await boot(page, testUrl.replace('renderer=webgl', 'renderer=webgpu').replace('quality=high', `quality=${tier}`));
    expect(await page.evaluate(() => window.__SS__!.perf().backend)).toBe('webgpu');
    const out = 'test-results/webgpu-blank/game'; mkdirSync(out, { recursive: true });
    for (const level of ['L1', 'L4', 'L8']) {
      await page.evaluate(async level => {
        const api = window.__SS__!; await api.loadLevel(level, { seed: 1 }); api.pause(); api.cheats.god(true);
        api.missions.begin(); await api.step(60);
        // Exercise the overlay in a real district even before the level's first Alpha encounter.
        const p = api.getState().player!.transform;
        api.spawn('infected.alpha', { x: p.x - 2, z: p.z - 2 }, { state: 'idle' });
        await api.step(1);
      }, level);
      for (const zoom of [1, .5]) {
        if (zoom === .5) {
          for (let i = 0; i < 7; i++) await page.locator('canvas').dispatchEvent('wheel', { deltaY: -100, deltaMode: 0 });
          await page.evaluate(() => window.__SS__!.step(120));
        }
        const pixels = await canvasFrame(page);
        const state = await page.evaluate(() => window.__SS__!.getState().render);
        if (zoom === 1) expect(state.healthBars!.count, `${level} Alpha bar exercises canvas compositing`).toBeGreaterThan(0);
        await page.locator('canvas').screenshot({ path: `${out}/${level}-${tier}-z${zoom}.png` });
        writeFileSync(`${out}/${level}-${tier}-z${zoom}.json`, JSON.stringify({ pixels, camera: state.camera, bars: state.healthBars, backend: state.backend }, null, 2));
        expect(state.camera.zoom).toBeCloseTo(zoom, 3);
        expect(canvasFrameChecks(pixels).filter(c => !c.pass), `${level} ${tier} zoom ${zoom}: ${JSON.stringify(pixels)}`).toEqual([]);
      }
    }
  });
}
