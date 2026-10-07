import { mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { boot, expect, test } from './fixtures';
import type { Page } from '@playwright/test';

const out = 'test-results/epics/E27';
/** Sim ticks after the blast at which E27-AC03 samples the seven beats. */
const beats = [0, 2, 6, 15, 40, 180, 900];
interface Frame { tick: number; png: PNG }
const lum = (d: Buffer, i: number) => (.2126 * d[i] + .7152 * d[i + 1] + .0722 * d[i + 2]) / 255;
function hsv(d: Buffer, i: number): [number, number, number] {
  const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255, max = Math.max(r, g, b), min = Math.min(r, g, b), c = max - min;
  const h = c === 0 ? 0 : max === r ? 60 * (((g - b) / c) % 6) : max === g ? 60 * ((b - r) / c + 2) : 60 * ((r - g) / c + 4);
  return [(h + 360) % 360, max ? c / max : 0, max];
}
/** Per-frame detectors over the whole frame and a disc around the projected blast centre. */
function measure(frame: PNG, base: PNG, cx: number, cy: number, radius: number) {
  let luminance = 0, fire = 0, gray = 0, n = 0, changed = 0, decalDark = 0, decalN = 0, sparks = 0; const distances: number[] = [];
  const { width, height, data } = frame;
  for (let y = 0; y < height; y += 2) for (let x = 0; x < width; x += 2) {
    const i = (y * width + x) * 4, l = lum(data, i), dl = l - lum(base.data, i), r = Math.hypot(x - cx, y - cy);
    luminance += l; n++;
    if (r > radius) continue;
    const [h, s, v] = hsv(data, i);
    if (h >= 8 && h <= 50 && s > .55 && v > .55) fire++;
    if (Math.abs(dl) > .06) { changed++; distances.push(r); }
    if (dl > .15 && r > 160) sparks++;
    // Smoke: desaturated, mid-tone change above the blast (the column rises up-screen).
    if (Math.abs(dl) > .04 && y < cy && s < .32 && v > .1 && v < .92) gray++;
    if (r < radius * .12) { decalN++; decalDark += dl; }
  }
  distances.sort((a, b) => a - b);
  return { luminance: luminance / n, fire, gray, changed, sparks, spread: distances.length ? distances[Math.floor(distances.length * .9)] : 0, decalDelta: decalN ? decalDark / decalN : 0 };
}
async function shot(page: Page, path?: string): Promise<PNG> {
  const buffer = await page.screenshot({ path });
  return PNG.sync.read(buffer);
}
async function lab(page: Page, settings: Record<string, unknown> = {}, spot = 'blast'): Promise<{ x: number; y: number }> {
  await boot(page);
  return page.evaluate(async ({ settings, spot }) => {
    const a = window.__SS__!; await a.loadScenario('blast-lab', { seed: 1 }); a.pause(); a.cheats.god(true);
    a.settings.set({ cameraShake: false, aimAssist: 'Off', vfx: true, gore: 'Full', ...settings });
    a.teleport('player', { x: -3, z: 7 }); a.camera.preset(spot); await a.step(30); a.vfx.stepRender(.5); await a.screenshotReady();
    return a.input.project({ x: 0, z: 0 });
  }, { settings, spot });
}

test('T-E27-03 @E27 @E27-AC03 medium blast seven beats in order at fixed ticks: flash, fireball, shockwave, debris, smoke, scorch', async ({ page }) => {
  test.setTimeout(120_000);
  mkdirSync(out, { recursive: true });
  const center = await lab(page);
  const base = await shot(page);
  await page.evaluate(() => window.__SS__!.explosions.blast('explosion.propane', { x: 0, z: 0 }));
  const frames: Frame[] = []; let at = 0;
  for (const tick of beats) {
    await page.evaluate(async n => { const a = window.__SS__!; if (n) { await a.step(n); a.vfx.stepRender(n / 60); } await a.screenshotReady(); }, tick - at);
    at = tick; frames.push({ tick, png: await shot(page, `${out}/ac03-t${String(tick).padStart(3, '0')}.png`) });
  }
  const radius = 600, m = frames.map(f => ({ tick: f.tick, ...measure(f.png, base, center.x, center.y, radius) })), b = measure(base, base, center.x, center.y, radius);
  writeFileSync(`${out}/ac03-detectors.json`, JSON.stringify({ center, baseline: b, frames: m }, null, 2));
  const [t0, t2, t6, t15, t40, t180, t900] = m;
  expect(t0.luminance - b.luminance, 'flash luminance spike').toBeGreaterThan(.08);       // beat 2 flash
  expect(Math.max(t2.fire, t6.fire), 'fireball fire-hue area').toBeGreaterThan(400);       // beat 3 fireball
  // The flash overlay changes every pixel until ~10 ticks; the ring is measured once it has cleared.
  expect(t40.spread, 'shockwave/dust ring grows').toBeGreaterThan(t15.spread);           // beat 4 shockwave
  expect(t15.sparks, 'debris sparks outside the fireball').toBeGreaterThan(200);           // beat 5 debris
  expect(t180.gray, 'smoke column gray area grows').toBeGreaterThan(t40.gray);             // beat 6 smoke
  expect(t900.decalDelta, 'scorch decal darkens the centre').toBeLessThan(-.05);           // beat 7 scorch
  const state = await page.evaluate(() => window.__SS__!.getState().render.vfx!.blasts);
  expect(state.scorch).toBeGreaterThanOrEqual(1);
});
