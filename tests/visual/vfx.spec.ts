import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { boot, test, expect } from '../e2e/fixtures';
import type { Page } from '@playwright/test';
import type { TelegraphKind } from '../../src/sim/world/types';
const output = 'test-results/epics/E15';
function save(name: string, value: unknown): void { mkdirSync(output, { recursive: true }); writeFileSync(`${output}/${name}.json`, JSON.stringify(value, null, 2) + '\n'); }
async function setup(page: Page, name: string): Promise<void> {
  await boot(page); mkdirSync(output, { recursive: true });
  await page.evaluate(async name => { const a = window.__SS__!; await a.loadScenario(name); a.pause(); a.camera.preset(name); a.settings.set({ gore: 'Full', vfx: true, cameraShake: false }); }, name);
}
async function capture(page: Page, name: string): Promise<PNG> { await page.evaluate(() => window.__SS__!.screenshotReady()); return PNG.sync.read(await page.screenshot({ path: `${output}/${name}.png` })); }
function hsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  r /= 255; g /= 255; b /= 255; const hi = Math.max(r, g, b), lo = Math.min(r, g, b), d = hi - lo;
  const h = d === 0 ? 0 : (hi === r ? (g - b) / d + (g < b ? 6 : 0) : hi === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60;
  return { h, s: hi ? d / hi : 0, v: hi };
}
function mean(image: PNG): number { let sum = 0; for (let i = 0; i < image.data.length; i += 4) sum += (image.data[i] * 0.2126 + image.data[i + 1] * 0.7152 + image.data[i + 2] * 0.0722) / 255; return sum / (image.width * image.height); }
function changed(a: PNG, b: PNG): number { let n = 0; for (let i = 0; i < a.data.length; i += 4) if (Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]) > 30) n++; return n; }

test('T-E15-03 @E15 @E15-AC03 @visual Full ground splat has palette red; Off has no red decal pixels', async ({ page }) => {
  await setup(page, 'blood-probe'); const results = [];
  for (const gore of ['Full', 'Off'] as const) {
    await page.evaluate(async gore => { const a = window.__SS__!; await a.loadScenario('blood-probe'); a.pause(); a.camera.preset('blood-probe'); a.settings.set({ gore, cameraShake: false }); await a.step(1); a.vfx.stepRender(0.9); }, gore);
    const image = await capture(page, `blood-${gore}`);
    const corners = await page.evaluate(() => [[2.65, -0.35], [3.35, -0.35], [3.35, 0.35], [2.65, 0.35]].map(([x, z]) => window.__SS__!.camera.project(x, 0.02, z)));
    const polygon = corners.map(p => [(p[0] + 1) / 2 * image.width, (1 - p[1]) / 2 * image.height]);
    let red = 0, sampled = 0;
    for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
      let inside = false;
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) { const a = polygon[i], b = polygon[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside; }
      if (!inside) continue; sampled++; const index = (y * image.width + x) * 4, c = hsv(image.data[index], image.data[index + 1], image.data[index + 2]);
      if ((c.h >= 345 || c.h <= 15) && c.s > 0.6 && c.v > 0.4) red++;
    }
    expect(sampled).toBeGreaterThan(30); expect(red).toBe(gore === 'Off' ? 0 : red); if (gore === 'Full') expect(red).toBeGreaterThan(10);
    expect((await page.evaluate(() => window.__SS__!.getState().render.vfx!)).decals).toBe(gore === 'Off' ? 0 : 1);
    results.push({ gore, red, sampled, polygon });
  }
  save('blood-pixels', results);
});

test('T-E15-04 @E15 @E15-AC04 @visual each sim telegraph appears in the next frame, stays until resolution, and has a distinct shape', async ({ page }) => {
  await setup(page, 'gore-probe'); const results = [];
  for (const [index, kind] of (['lunge', 'charge', 'splash', 'bloated'] as TelegraphKind[]).entries()) {
    const baseline = await capture(page, `telegraph-${kind}-off`);
    const tell = await page.evaluate(kind => {
      const a = window.__SS__!; a.vfx.emit({ type: 'telegraph', attackId: 7, kind, position: { x: 3, z: 0 }, radius: 2, angle: 0 }); return { tick: a.tick(), state: a.getState().render.vfx! };
    }, kind);
    expect(tell.state.telegraphs).toHaveLength(1); expect(tell.state.telegraphs[0].kind).toBe(kind);
    const on = await capture(page, `telegraph-${kind}`); const pixels = changed(baseline, on); expect(pixels).toBeGreaterThan(100);
    await page.evaluate(() => window.__SS__!.vfx.stepRender(0.05));
    const settled = await capture(page, `telegraph-${kind}-settled`);
    expect(changed(on, settled), 'birth frame must have the same solid footprint as the settled tell').toBeLessThan(200);
    const persistence = await page.evaluate(async () => { const a = window.__SS__!; await a.step(180); for (let i = 0; i < 5; i++) a.vfx.stepRender(1); const during = a.getState().render.vfx!; a.vfx.emit({ type: 'attack.resolved', attackId: 7 }); return { during, after: a.getState().render.vfx! }; });
    expect(persistence.during.telegraphs).toHaveLength(1); expect(persistence.after.telegraphs).toHaveLength(0); results.push({ index, kind, pixels, tell, persistence });
  }
  expect(new Set(results.map(r => r.pixels)).size).toBe(4); save('telegraphs', results);
  // Re-enabling at a nonzero paused visual time must still show the next tell immediately.
  await page.evaluate(() => window.__SS__!.settings.set({ vfx: false }));
  const off = await capture(page, 'telegraph-toggle-off');
  await page.evaluate(() => {
    const a = window.__SS__!; a.settings.set({ vfx: true });
    a.vfx.emit({ type: 'telegraph', attackId: 8, kind: 'lunge', position: { x: 3, z: 0 }, radius: 2, angle: 0 });
  });
  const on = await capture(page, 'telegraph-toggle-on'); expect(changed(off, on)).toBeGreaterThan(100);
});

test('T-E15-05 @E15 @E15-AC05 @visual measured shockwave screen radius scales with splash radius ±15%', async ({ page }) => {
  await setup(page, 'gore-probe'); const results = [];
  for (const radius of [2, 4, 6]) {
    await page.evaluate(async () => { const a = window.__SS__!; await a.loadScenario('gore-probe'); a.pause(); a.camera.preset('gore-probe'); a.settings.set({ cameraShake: false, flashReduction: true }); });
    const baseline = await capture(page, `ring-${radius}-off`);
    await page.evaluate(radius => { const a = window.__SS__!; a.vfx.emit({ type: 'vfx.effect', kind: 'explosion', position: { x: 0, z: 0 }, radius }); a.vfx.stepRender(0.4); }, radius);
    const image = await capture(page, `ring-${radius}`);
    const center = await page.evaluate(() => window.__SS__!.camera.project(0, 0.035, 0));
    const cx = (center[0] + 1) / 2 * image.width, cy = (1 - center[1]) / 2 * image.height;
    let screenRadius = 0, pixels = 0;
    for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
      const i = (y * image.width + x) * 4, c = hsv(image.data[i], image.data[i + 1], image.data[i + 2]);
      const differs = Math.abs(image.data[i] - baseline.data[i]) + Math.abs(image.data[i + 1] - baseline.data[i + 1]) + Math.abs(image.data[i + 2] - baseline.data[i + 2]) > 50;
      if (differs && c.h >= 25 && c.h <= 65 && c.v > 0.7 && c.s > 0.2) { pixels++; screenRadius = Math.max(screenRadius, Math.hypot(x - cx, y - cy)); }
    }
    expect(pixels).toBeGreaterThan(100); results.push({ radius, screenRadius, pixels });
  }
  const ratio = results[0].screenRadius / results[0].radius;
  for (const result of results.slice(1)) expect(Math.abs(result.screenRadius / result.radius / ratio - 1)).toBeLessThanOrEqual(0.15);
  save('shockwave', results);
});

test('T-E15-07 @E15 @E15-AC07 @vision golden-hour and night showcases have reviewed combat readability', async ({ page }) => {
  await setup(page, 'vfx-showcase');
  for (const lighting of ['L4', 'L6'] as const) {
    await page.evaluate(async lighting => { const a = window.__SS__!; await a.loadScenario('vfx-showcase'); a.pause(); a.camera.preset(lighting); a.settings.set({ cameraShake: false, gore: 'Full' }); await a.step(1); a.vfx.stepRender(0.12); }, lighting);
    const image = await capture(page, `showcase-${lighting}`); expect(mean(image)).toBeGreaterThan(0.06);
    expect(await page.evaluate(() => window.__SS__!.getState().render.lighting!.preset)).toBe(lighting);
  }
  // A completed review must cite the exact images, with all must and ≥70% should checks passing.
  const review = readFileSync(`${output}/review.md`, 'utf8');
  for (const tier of ['L4', 'L6']) for (const item of ['D1', 'D2', 'D3', 'D4', 'D5']) expect(review).toMatch(new RegExp(`${tier}-${item}.*PASS`));
});

test('T-E15-08 @E15 @E15-AC08 @visual flash reduction keeps successive explosion brightness deltas within 20%', async ({ page }) => {
  await setup(page, 'gore-probe'); const results = [];
  for (const reduced of [true, false]) {
    await page.evaluate(async reduced => { const a = window.__SS__!; await a.loadScenario('gore-probe'); a.pause(); a.camera.preset('gore-probe'); a.settings.set({ cameraShake: false, flashReduction: reduced }); }, reduced);
    const before = await capture(page, `flash-${reduced}-baseline`); const frames = [mean(before)];
    await page.evaluate(() => window.__SS__!.vfx.emit({ type: 'vfx.effect', kind: 'explosion', position: { x: 0, z: 0 }, radius: 6 }));
    frames.push(mean(await capture(page, `flash-${reduced}-0`)));
    for (let i = 1; i <= 8; i++) { await page.evaluate(() => window.__SS__!.vfx.stepRender(1 / 60)); frames.push(mean(await capture(page, `flash-${reduced}-${i}`))); }
    const deltas = frames.slice(1).map((v, i) => Math.abs(v - frames[i]));
    if (reduced) expect(Math.max(...deltas)).toBeLessThanOrEqual(0.2); else expect(Math.max(...deltas)).toBeGreaterThan(0.2);
    results.push({ reduced, frames, deltas });
  }
  save('flash-reduction', results);
});
