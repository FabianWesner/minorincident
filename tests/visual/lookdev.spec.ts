import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { boot, expect, test } from '../e2e/fixtures';
import type { Page } from '@playwright/test';

const output = 'test-results/epics/E02';
function artifact(name: string, value: unknown): void { mkdirSync(output, { recursive: true }); writeFileSync(`${output}/${name}.json`, JSON.stringify(value, null, 2) + '\n'); }
async function lookdev(page: Page, spot = 'overview'): Promise<void> {
  await boot(page);
  await page.evaluate(async (name) => { const api = window.__SS__!; await api.loadScenario('lookdev', { seed: 1 }); api.pause(); api.camera.preset(name); await api.step(60); await api.screenshotReady(); }, spot);
}
async function capture(page: Page, name: string): Promise<PNG> { await page.evaluate(() => window.__SS__!.screenshotReady()); return PNG.sync.read(await page.screenshot({ path: `${output}/${name}.png` })); }
function rgb(image: PNG, x: number, y: number): number[] { return [...image.data.subarray((Math.round(y) * image.width + Math.round(x)) * 4, (Math.round(y) * image.width + Math.round(x)) * 4 + 3)]; }
function hsl([r, g, b]: number[]): { hue: number; lightness: number } {
  r /= 255; g /= 255; b /= 255; const hi = Math.max(r, g, b), lo = Math.min(r, g, b), d = hi - lo;
  const hue = d === 0 ? 0 : (hi === r ? (g - b) / d + (g < b ? 6 : 0) : hi === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60;
  return { hue, lightness: (hi + lo) / 2 };
}
function luminance(c: number[]): number { return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
function mean(image: PNG): { luminance: number; hue: number } {
  const sum = [0, 0, 0]; for (let i = 0; i < image.data.length; i += 4) for (let c = 0; c < 3; c++) sum[c] += image.data[i + c];
  const color = sum.map((x) => x / (image.width * image.height)); return { luminance: luminance(color), hue: hsl(color).hue };
}
function pixels(image: PNG): number { let count = 0; for (let i = 0; i < image.data.length; i += 4) if (image.data[i] > 240 && image.data[i + 1] < 20 && image.data[i + 2] > 240) count++; return count; }

test('T-E02-06 @E02 @E02-AC06 shadow probe is purple-blue and above 15% lightness', async ({ page }) => {
  await lookdev(page, 'shadow-probe'); const image = await capture(page, 'shadow-probe');
  const p = await page.evaluate(() => window.__SS__!.getState().render.probes!.shadow);
  const color = rgb(image, (p[0] + 1) / 2 * image.width, (1 - p[1]) / 2 * image.height), sample = hsl(color);
  artifact('shadow', { color, ...sample, ndc: p });
  expect(sample.hue).toBeGreaterThanOrEqual(230); expect(sample.hue).toBeLessThanOrEqual(290); expect(sample.lightness).toBeGreaterThan(0.15);
});

test('T-E02-07 @E02 @E02-AC07 lamp 8 px ring gains at least 10% brightness from bloom', async ({ page }) => {
  await lookdev(page, 'street');
  const p = await page.evaluate(() => window.__SS__!.getState().render.probes!.lamp);
  const on = await capture(page, 'bloom-on'); await page.evaluate(() => window.__SS__!.settings.set({ bloom: false })); const off = await capture(page, 'bloom-off');
  const x = (p[0] + 1) / 2 * on.width, y = (1 - p[1]) / 2 * on.height;
  // Scan the lamp's white silhouette first; the ring is 8 px wide OUTSIDE the source.
  let radius = 0;
  while (radius < 30 && rgb(off, x + radius, y).every((c) => c > 240)) radius++;
  expect(radius).toBeGreaterThan(0);
  const outer = radius + 8;
  const ring = (image: PNG): number => {
    let sum = 0, n = 0;
    for (let dy = -outer; dy <= outer; dy++) for (let dx = -outer; dx <= outer; dx++) if (Math.hypot(dx, dy) >= radius && Math.hypot(dx, dy) <= outer) { sum += luminance(rgb(image, x + dx, y + dy)); n++; }
    return sum / n;
  };
  artifact('bloom', { on: ring(on), off: ring(off), ratio: ring(on) / ring(off), innerRadius: radius, ringWidth: 8, ndc: p });
  expect(ring(on)).toBeGreaterThanOrEqual(ring(off) * 1.1);
});

test('T-E02-08 @E02 @E02-AC08 occluder fades in 0.3 s, hides roof inside, and preserves >70% player mask', async ({ page }) => {
  await lookdev(page);
  const result = await page.evaluate(async () => {
    const api = window.__SS__!; api.camera.follow(); api.teleport('player', { x: -11, z: -7 }); await api.step(120);
    const occlusion = api.getState().render.occlusion;
    api.settings.set({ idPass: true }); return occlusion;
  });
  expect(result.some((b) => b.blocked)).toBe(true);
  for (const building of result.filter((b) => b.blocked)) expect(building.opacity).toBeLessThanOrEqual(0.35);
  const occluded = await capture(page, 'player-mask-occluded');
  await page.evaluate(() => window.__SS__!.settings.set({ occludersVisible: false })); const unobstructed = await capture(page, 'player-mask-reference');
  artifact('occlusion', { buildings: result, visible: pixels(occluded), reference: pixels(unobstructed), ratio: pixels(occluded) / pixels(unobstructed) });
  expect(pixels(unobstructed)).toBeGreaterThan(100); expect(pixels(occluded) / pixels(unobstructed)).toBeGreaterThan(0.7);
  const timed = await page.evaluate(async () => {
    const api = window.__SS__!; api.settings.set({ idPass: false, occludersVisible: true }); api.teleport('player', { x: 0, z: 0 }); await api.step(120);
    api.teleport('player', { x: -7, z: -4 }); await api.step(18); return api.getState().render.occlusion;
  });
  expect(timed.find((b) => b.name === 'house--7')).toMatchObject({ blocked: true, roofsHidden: true });
  expect(timed.find((b) => b.name === 'house--7')!.opacity).toBeLessThanOrEqual(0.35);
  await capture(page, 'occlusion-inside');
});

test('T-E02-09 @E02 @E02-AC09 L1, L4 and L6 change lighting and screenshot hue/luminance', async ({ page }) => {
  await lookdev(page);
  const results: Record<string, { luminance: number; hue: number }> = {}, states: unknown[] = [];
  for (const preset of ['L1', 'L4', 'L6'] as const) {
    await page.evaluate((timeOfDay) => window.__SS__!.settings.set({ timeOfDay }), preset);
    results[preset] = mean(await capture(page, preset)); states.push(await page.evaluate(() => window.__SS__!.getState().render.lighting));
  }
  artifact('time-of-day', { results, states });
  expect(results.L1.luminance).toBeGreaterThan(results.L4.luminance); expect(results.L4.luminance).toBeGreaterThan(results.L6.luminance);
  for (const property of ['sunDirection', 'sunColor', 'sky', 'fog']) expect(new Set(states.map((s) => JSON.stringify((s as Record<string, unknown>)[property]))).size).toBe(3);
  expect(Math.abs(results.L1.hue - results.L4.hue)).toBeGreaterThan(5); expect(Math.abs(results.L4.hue - results.L6.hue)).toBeGreaterThan(5);
});

test('T-E02-10 @E02 @E02-AC10 golden lookdev has a reviewed North-star vision checklist', async ({ page }) => {
  await lookdev(page); await capture(page, 'golden');
  const review = readFileSync('tests/visual/__goldens__/review.md', 'utf8');
  writeFileSync(`${output}/review.md`, review);
  for (const item of ['A1', 'A2', 'A3', 'A4']) expect(review).toMatch(new RegExp(`${item}.*PASS`));
  expect((review.match(/A[5-8].*PASS/g) ?? []).length).toBeGreaterThanOrEqual(3);
});

test('T-E02-11 @E02 @E02-AC11 overview, street and shadow-probe match reviewed goldens within 1.5%', async ({ page }) => {
  await lookdev(page);
  await page.addStyleTag({ content: 'body > :not(#game), #game > :not(canvas) { visibility: hidden !important; }' });
  for (const spot of ['overview', 'street', 'shadow-probe']) {
    await page.evaluate((name) => window.__SS__!.camera.preset(name), spot); await page.evaluate(() => window.__SS__!.screenshotReady());
    // Compare the rendered scene; DOM controls are maintained by the input/UI epics.
    const png = await page.locator('canvas').screenshot({ path: `${output}/${spot}.png` });
    expect(png).toMatchSnapshot(`${spot}.png`, { threshold: 0.1, maxDiffPixelRatio: 0.015 });
  }
});

test('T-E02-dof @E02 optional tilt-shift changes the edges and preserves the central play area', async ({ page }) => {
  await lookdev(page);
  const sharp = await capture(page, 'cheap-dof-off');
  await page.evaluate(() => window.__SS__!.settings.set({ cheapDof: true }));
  const blurred = await capture(page, 'cheap-dof-on');
  const { default: pixelmatch } = await import('pixelmatch');
  const top = Math.floor(sharp.height * 0.2), height = Math.floor(sharp.height * 0.6), stride = sharp.width * 4;
  expect(pixelmatch(sharp.data.subarray(top * stride, (top + height) * stride), blurred.data.subarray(top * stride, (top + height) * stride), undefined, sharp.width, height, { threshold: 0.01 })).toBe(0);
  expect(pixelmatch(sharp.data, blurred.data, undefined, sharp.width, sharp.height, { threshold: 0.01 })).toBeGreaterThan(100);
});

test('T-E02-fog @E02 @E02-AC09 palette surfaces beyond fogFar resolve to the preset fog color', async ({ page }) => {
  await lookdev(page);
  const p = await page.evaluate(async () => {
    const api = window.__SS__!; api.camera.cinematic({ position: [100, 100, 100], target: [0, 0, 0] }); await api.step(60);
    return api.camera.project(0, 0.05, 8);
  });
  const image = await capture(page, 'fog-far'); const color = rgb(image, (p[0] + 1) / 2 * image.width, (1 - p[1]) / 2 * image.height);
  artifact('fog', { color, expected: [229, 179, 158] });
  for (let c = 0; c < 3; c++) expect(Math.abs(color[c] - [229, 179, 158][c])).toBeLessThanOrEqual(2);
});
