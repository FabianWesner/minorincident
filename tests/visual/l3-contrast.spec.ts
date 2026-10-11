import { mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { test, expect, boot } from '../e2e/fixtures';
import type { SceneSpec } from '../../src/debug/scenelab/spec';
import { weatherTimelines } from '../../src/data/weather';

const out = `test-results/l3-contrast/${process.env.L3_CAPTURE ?? 'after'}`;
const linear = (v: number) => v / 255 <= .04045 ? v / 255 / 12.92 : ((v / 255 + .055) / 1.055) ** 2.4;
/** Linear luminance and HSV saturation inside the courier ID mask, excluding its antialiased edge. */
function measure(image: PNG, mask: PNG) {
  const luminances: number[] = [], saturations: number[] = [];
  for (let y = 1; y < mask.height - 1; y++) for (let x = 1; x < mask.width - 1; x++) {
    const inside = (x: number, y: number) => { const i = (y * mask.width + x) * 4; return mask.data[i] > 240 && mask.data[i + 1] < 20 && mask.data[i + 2] > 240; };
    if (![ [x, y], [x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1] ].every(([x, y]) => inside(x, y))) continue;
    const i = (y * image.width + x) * 4, r = image.data[i], g = image.data[i + 1], b = image.data[i + 2];
    luminances.push(.2126 * linear(r) + .7152 * linear(g) + .0722 * linear(b));
    saturations.push((Math.max(r, g, b) - Math.min(r, g, b)) / Math.max(1, r, g, b));
  }
  luminances.sort((a, b) => a - b);
  const p5 = luminances[Math.floor(luminances.length * .05)], p95 = luminances[Math.floor(luminances.length * .95)];
  return { pixels: luminances.length, p5, p95, range: p95 - p5, contrast: (p95 - p5) / (p95 + p5), saturation: saturations.reduce((a, b) => a + b, 0) / saturations.length };
}

test('L3 courier retains contrast and colour through the authored haze-to-ash timeline @E25 @visual', async ({ page }) => {
  test.setTimeout(300_000);
  mkdirSync(out, { recursive: true });
  await boot(page, '/?test=1&scenelab&renderer=webgl&quality=high&audio=muted&dpr=1');
  const report: Record<string, ReturnType<typeof measure>> = {};
  for (const camera of ['game', 'close'] as const) {
    for (const state of ['L1', 'L2', 'L3-clear', 'start', 'mid', 'end', 'late'] as const) {
      const spec: SceneSpec = {
        ground: 'asphalt', size: 40, dof: false,
        time: state === 'L1' || state === 'L2' ? state : 'L3',
        weatherTimeline: state === 'L1' || state === 'L2' || state === 'L3-clear' ? [{ tick: 0, kind: 'clear' }] : weatherTimelines.L3,
        weatherWarmup: state === 'mid' ? 112.5 : state === 'end' ? 135 : state === 'late' ? 240 : state === 'start' ? 90 : 0,
        actors: [{ id: 'courier', kind: 'courier', at: [0, 0], yaw: 0, state: { select: 'RIGHT' }, loadout: ['weapon.bat', 'weapon.handgun'] }, { id: 'corgi', kind: 'corgi', at: [-.8, -.8], state: 'idle' }],
        camera: camera === 'game' ? { mode: 'game', target: [0, 0] } : { mode: 'close', target: [0, .8, 0], radius: 5, azimuth: 45 },
      };
      await page.evaluate(async spec => { await window.__SCENE__!.load(spec); await window.__SCENE__!.step(1); await window.__SS__!.screenshotReady(); }, spec);
      const name = `${camera}-${state}`;
      const image = PNG.sync.read(await page.locator('canvas').screenshot({ path: `${out}/${name}-paused.png` }));
      await page.evaluate(async () => {
        // Particle vertex/opacity graphs are replaced by the ID pass; their raw quads must not occlude the mask.
        const game = (window.__SCENE__ as unknown as { game: import('../../src/Game').Game }).game;
        game.view.weather!.visible = false;
        window.__SS__!.settings.set({ idPass: true }); await window.__SS__!.screenshotReady();
      });
      const mask = PNG.sync.read(await page.locator('canvas').screenshot({ path: `${out}/${name}-mask.png` }));
      await page.evaluate(async () => {
        const game = (window.__SCENE__ as unknown as { game: import('../../src/Game').Game }).game;
        game.view.weather!.visible = true;
        window.__SS__!.settings.set({ idPass: false }); await window.__SS__!.screenshotReady();
      });
      report[name] = measure(image, mask);
      // Resume the real clock, then pause immediately after the capture to keep the fixture stable.
      await page.evaluate(() => window.__SS__!.resume());
      await page.locator('canvas').screenshot({ path: `${out}/${name}-unpaused.png` });
      await page.evaluate(() => window.__SS__!.pause());
    }
  }
  writeFileSync(`${out}/contrast.json`, JSON.stringify(report, null, 2) + '\n');
  for (const camera of ['game', 'close']) for (const state of ['start', 'mid', 'end', 'late']) {
    const baseline = report[`${camera}-L1`], actual = report[`${camera}-${state}`];
    expect.soft(actual.pixels).toBeGreaterThan(100);
    expect.soft(actual.pixels / baseline.pixels, `${camera}/${state}: full courier mask`).toBeGreaterThan(.95);
    // Michelson contrast normalizes the p5–p95 range by brightness: L3 retains its darker afternoon mood.
    expect.soft(actual.contrast / baseline.contrast, `${camera}/${state}: p5–p95 contrast relative to L1`).toBeGreaterThanOrEqual(.85);
    expect.soft(actual.contrast / baseline.contrast, `${camera}/${state}: p5–p95 contrast relative to L1`).toBeLessThanOrEqual(1.15);
    // L2's brighter midday light is less saturated than L1. Keep L3 inside their daylight colour range.
    const daylightSaturation = Math.min(baseline.saturation, report[`${camera}-L2`].saturation);
    expect.soft(actual.saturation / daylightSaturation, `${camera}/${state}: retained daylight colour saturation`).toBeGreaterThanOrEqual(.95);
    expect.soft(actual.p5 - baseline.p5, `${camera}/${state}: dark colours must not turn milky`).toBeLessThanOrEqual(.025);
  }
});

test('L3 station yard game and close cameras, pause menu and live weather captures @visual', async ({ page }) => {
  test.setTimeout(240_000);
  mkdirSync(out, { recursive: true });
  await boot(page, '/?test=1&scenelab&ui=1&renderer=webgl&quality=high&audio=muted&dpr=1');
  await page.evaluate(async () => {
    const a = window.__SS__!;
    await a.loadLevel('L3', { seed: 1, progression: 'L3-default' }); a.pause(); a.cheats.god(true);
    a.teleport('player', { x: -135, z: 1.5 }); a.setLoadout(['weapon.bat'], ['weapon.handgun']);
    const dog = a.getState().entities.find(e => e.companion);
    if (dog) a.teleport(dog.id, { x: -135.8, z: .7 });
    const game = (window.__SCENE__ as unknown as { game: import('../../src/Game').Game }).game;
    game.world.combat!.runner.loadout.state.selectedSide = 'RIGHT';
  });
  await page.getByRole('button', { name: 'Begin mission' }).click();
  await page.evaluate(() => window.__SS__!.pause());
  for (const [state, seconds] of [['start', 90], ['mid', 112.5], ['end', 135], ['late', 240]] as const) {
    const weather = await page.evaluate(seconds => {
      const game = (window.__SCENE__ as unknown as { game: import('../../src/Game').Game }).game;
      while (game.world.tick < seconds * 60) { game.world.tick++; game.world.weather!.update(); }
      game.view.update(1); return game.world.weather!.snapshot();
    }, seconds);
    writeFileSync(`${out}/yard-${state}-weather.json`, JSON.stringify(weather, null, 2) + '\n');
    for (const camera of ['game', 'close'] as const) {
      await page.evaluate(async camera => {
        const a = window.__SS__!, p = a.getEntity(1)!.transform;
        if (camera === 'game') {
          // Snap the standard follow framing; a paused clock cannot finish its cinematic-to-follow blend.
          const side = 19 * Math.sin(Math.PI * .30) / Math.SQRT2;
          a.camera.cinematic({ position: [p.x + side, 19 * Math.cos(Math.PI * .30), p.z + side], target: [p.x, 0, p.z] }, true);
        } else a.camera.cinematic({ position: [p.x + 3.5, 4.5, p.z + 3.5], target: [p.x, .8, p.z] }, true);
        await a.screenshotReady();
      }, camera);
      await page.evaluate(() => window.__SS__!.resume());
      await page.screenshot({ path: `${out}/yard-${camera}-${state}-unpaused.png` });
      await page.keyboard.press('Escape');
      await expect(page.locator('body')).toHaveAttribute('data-ui-screen', 'pause');
      await page.screenshot({ path: `${out}/yard-${camera}-${state}-paused.png` });
      await page.keyboard.press('Escape');
      await page.evaluate(() => window.__SS__!.pause());
    }
  }
});
