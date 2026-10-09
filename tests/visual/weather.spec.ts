import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { type Page } from '@playwright/test';
import { test, expect, boot } from '../e2e/fixtures';
import type { SceneSpec } from '../../src/debug/scenelab/spec';
const out = 'test-results/epics/E28/visual';
const spec = (kind: string): SceneSpec => JSON.parse(readFileSync(`specs/scenes/weather-lab-${kind}.json`, 'utf8'));
async function lab(page: Page, scene: SceneSpec) {
  await boot(page, '/?test=1&scenelab&renderer=webgl&quality=high&audio=muted&dpr=1&profile');
  await page.evaluate(async scene => { await window.__SCENE__!.load(scene); await window.__SCENE__!.step(1); }, scene);
}
async function shot(page: Page, name: string) { await page.evaluate(() => window.__SS__!.screenshotReady()); mkdirSync(out, { recursive: true }); return PNG.sync.read(await page.locator('canvas').screenshot({ path: `${out}/${name}.png` })); }
const lum = (r: number, g: number, b: number) => { const c = (v: number) => (v / 255) <= .04045 ? v / 255 / 12.92 : ((v / 255 + .055) / 1.055) ** 2.4; return .2126 * c(r) + .7152 * c(g) + .0722 * c(b); };

test('T-E28-03b @E28 @E28-AC03 @visual wet mask follows accumulated rain and has a dry state', async ({ page }) => {
  const dry = { ...spec('clear'), time: 'night' as const }; await lab(page, dry);
  await page.evaluate(() => window.__SS__!.weather.probe('wet')); const before = await shot(page, 'wet-mask-dry');
  await page.evaluate(async scene => { await window.__SCENE__!.load(scene); await window.__SCENE__!.step(1); window.__SS__!.weather.probe('wet'); }, { ...spec('rain'), time: 'night' as const });
  const after = await shot(page, 'wet-mask-rain');
  const coverage = (p: PNG) => { let n = 0; for (let i = 0; i < p.data.length; i += 4) if (p.data[i] > 150 && p.data[i + 1] > 150 && p.data[i + 2] > 150) n++; return n; };
  expect(coverage(after)).toBeGreaterThan(coverage(before) + 10_000);
  await page.evaluate(() => window.__SS__!.weather.probe(null)); await shot(page, 'wet-reflections');
});
test('T-E28-05b @E28 @E28-AC05 @visual fog player contrast is at least 3:1 against the 2m ring', async ({ page }) => {
  await lab(page, { ...spec('fog'), props: [], vehicles: [], actors: [{ id: 'courier', kind: 'courier', at: [0, 0], state: 'idle' }], camera: { mode: 'game', target: [0, 0] } });
  const image = await shot(page, 'fog-player');
  const ring = await page.evaluate(() => { const a = window.__SS__!, p = a.getEntity(1)!.transform; return Array.from({ length: 8 }, (_, k) => a.camera.project(p.x + 2 * Math.cos(k * Math.PI / 4), .05, p.z + 2 * Math.sin(k * Math.PI / 4))); });
  await page.evaluate(() => window.__SS__!.settings.set({ idPass: true })); const mask = await shot(page, 'fog-player-mask');
  let sum = 0, n = 0; for (let i = 0; i < mask.data.length; i += 4) if (mask.data[i] > 240 && mask.data[i + 1] < 20 && mask.data[i + 2] > 240) { sum += lum(image.data[i], image.data[i + 1], image.data[i + 2]); n++; }
  const surroundings = ring.map(p => { const x = Math.round((p[0] + 1) / 2 * image.width), y = Math.round((1 - p[1]) / 2 * image.height); let s = 0, count = 0; for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) { const i = ((y + dz) * image.width + x + dx) * 4; s += lum(image.data[i], image.data[i + 1], image.data[i + 2]); count++; } return s / count; });
  const contrast = (sum / n + .05) / (surroundings.reduce((a, b) => a + b, 0) / surroundings.length + .05);
  writeFileSync(`${out}/fog-contrast.json`, JSON.stringify({ contrast, pixels: n })); expect(n).toBeGreaterThan(100); expect(contrast).toBeGreaterThanOrEqual(3);
});
test('T-E28-06c @E28 @E28-AC06 @visual smoke columns bend along the weather wind', async ({ page }) => {
  await lab(page, spec('wind')); await page.evaluate(() => window.__SCENE__!.step(119)); await shot(page, 'wind-smoke');
  const s = await page.evaluate(() => window.__SS__!.getState()); const wind = s.weather!.wind, drawn = s.render.vfx!.blasts.wind;
  const angle = Math.acos((wind.x * drawn.x + wind.z * drawn.z) / Math.hypot(wind.x, wind.z) / Math.hypot(drawn.x, drawn.z)) * 180 / Math.PI;
  expect(angle).toBeLessThanOrEqual(20);
});
test('T-E28-07b @E28 @E28-AC07 @visual roof/car up-facing accumulation covers >=60% and track texels grow', async ({ page }) => {
  await lab(page, spec('snow'));
  const coverage = async (asset: string) => {
    await page.evaluate(asset => window.__SS__!.weather.probe('up', asset), asset); const up = await shot(page, `${asset}-up`);
    await page.evaluate(asset => window.__SS__!.weather.probe('snow', asset), asset); const snow = await shot(page, `${asset}-snow`);
    let all = 0, covered = 0; for (let i = 0; i < up.data.length; i += 4) if (up.data[i] > 240 && up.data[i + 1] > 240 && up.data[i + 2] > 240) { all++; if (snow.data[i] >= 153) covered++; }
    expect(all).toBeGreaterThan(100); return covered / all;
  };
  const roof = await coverage('bld.house-a'), car = await coverage('veh.sedan-red');
  expect(roof).toBeGreaterThanOrEqual(.6); expect(car).toBeGreaterThanOrEqual(.6);
  await page.evaluate(() => window.__SS__!.weather.probe(null)); const before = await page.evaluate(() => window.__SS__!.getState().render.weather!.trackPixels);
  await page.evaluate(() => window.__SCENE__!.step(119)); const after = await page.evaluate(() => window.__SS__!.getState().render.weather!.trackPixels);
  expect(after).toBeGreaterThan(before); await shot(page, 'snow-tracks'); writeFileSync(`${out}/snow-coverage.json`, JSON.stringify({ roof, car, before, after }));
});
for (const kind of ['clear', 'overcast', 'haze', 'thunderstorm', 'fog', 'snow']) test(`T-E28-12-${kind} @E28 @E28-AC12 @vision game-camera weather mood ${kind}`, async ({ page }) => {
  await lab(page, spec(kind)); await page.evaluate(() => window.__SCENE__!.step(61)); await shot(page, `mood-${kind}`);
  expect(await page.evaluate(() => window.__SS__!.getState().weather!.kind)).toBe(kind);
});

test('T-E28-11b @E28 @E28-AC11 @visual precipitation dither leaves fewer ray pixels', async ({ page }) => {
  await lab(page, spec('thunderstorm'));
  await page.evaluate(() => window.__SS__!.weather.probe('dense-precipitation')); const dense = await shot(page, 'rain-ray-undithered');
  await page.evaluate(() => window.__SS__!.weather.probe('precipitation')); const sparse = await shot(page, 'rain-ray-dithered');
  const count = (p: PNG) => { let n = 0; for (let y = p.height * .35 | 0; y < p.height * .65; y++) for (let x = p.width * .4 | 0; x < p.width * .6; x++) if (p.data[(y * p.width + x) * 4] > 30) n++; return n; };
  const before = count(dense), after = count(sparse); expect(before).toBeGreaterThan(100); expect(after).toBeLessThan(before * .5);
  writeFileSync(`${out}/rain-dither.json`, JSON.stringify({ before, after })); await page.evaluate(() => window.__SS__!.weather.probe(null));
});
