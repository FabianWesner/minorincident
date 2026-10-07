import { mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { test, expect, boot } from '../e2e/fixtures';
import type { Page } from '@playwright/test';

const out = 'test-results/epics/E25';
const lum = (r: number, g: number, b: number) => { const c = (v: number) => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * c(r) + .7152 * c(g) + .0722 * c(b); };
const hue = (r: number, g: number, b: number) => { const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min || 1; const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4; return (h * 60 + 360) % 360; };
async function shot(page: Page, name: string) { return PNG.sync.read(await page.locator('canvas').screenshot({ path: `${out}/${name}.png` })); }
/** Average colour of a small disc of canvas pixels around an NDC point. */
function patch(png: PNG, ndc: number[], radius = 6) {
  const cx = Math.round((ndc[0] + 1) / 2 * png.width), cy = Math.round((1 - ndc[1]) / 2 * png.height); let r = 0, g = 0, b = 0, n = 0;
  for (let y = cy - radius; y <= cy + radius; y++) for (let x = cx - radius; x <= cx + radius; x++) {
    if (x < 0 || y < 0 || x >= png.width || y >= png.height || Math.hypot(x - cx, y - cy) > radius) continue;
    const i = (y * png.width + x) * 4; r += png.data[i]; g += png.data[i + 1]; b += png.data[i + 2]; n++;
  }
  return { r: r / n, g: g / n, b: b / n, l: lum(r / n, g / n, b / n) };
}
const lampSpot = { x: 62.2, z: -1.4 };

test.beforeAll(() => mkdirSync(out, { recursive: true }));

test('T-E25-moods @E25 @vision game-camera mood per time-of-day preset: readable player, infected and pickups', async ({ page }) => {
  test.setTimeout(180_000);
  await boot(page);
  await page.evaluate(async (spot) => {
    const a = window.__SS__!; await a.loadLevel('D-GROVE'); a.pause(); a.cheats.god(true);
    a.teleport('player', spot);
    for (let i = 0; i < 6; i++) a.spawn('infected.runner', { x: 58 + i * 1.3, z: 2 + (i % 2) }, { state: 'idle', yaw: -Math.PI / 4 });
    a.spawn('weapon.pistol', { x: spot.x + 2.5, z: spot.z + 2 });
    a.camera.follow(); await a.step(30); await a.screenshotReady();
  }, lampSpot);
  const report: Record<string, unknown> = {};
  for (const preset of ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'night'] as const) {
    report[preset] = await page.evaluate(async (preset) => { const a = window.__SS__!; a.settings.set({ timeOfDay: preset }); await a.step(1); await a.screenshotReady(); return { lighting: a.perf().lighting, drawCalls: a.perf().drawCalls }; }, preset);
    await shot(page, `mood-${preset}`);
  }
  writeFileSync(`${out}/moods.json`, JSON.stringify(report, null, 2) + '\n');
  const moods = report as Record<string, { lighting: { lightPools: number; preset: string } }>;
  expect(moods.L1.lighting.lightPools).toBe(0); expect(moods.night.lighting.lightPools).toBeGreaterThan(40);
});

test('T-E25-13 @E25 @E25-AC13 night-street: player contrast against its 2 m ring with no practical light nearby; infected eyes are their brightest pixels', async ({ page }) => {
  test.setTimeout(180_000);
  await boot(page);
  const setup = await page.evaluate(async () => {
    const a = window.__SS__!; await a.loadLevel('night-street'); a.pause(); a.cheats.god(true);
    const spot = { x: 51, z: -32.5 }; a.teleport('player', spot);
    const ids = [0, 1, 2].map(i => a.spawn('infected.runner', { x: spot.x - 3 + i * 1.6, z: spot.z + 3.5 }, { state: 'idle', yaw: -Math.PI / 4 }));
    a.camera.follow(); await a.step(90); await a.screenshotReady();
    const p = a.query({ kind: 'player' })[0]?.transform ?? a.getEntity(1)!.transform;
    const ring = [0, 1, 2, 3, 4, 5, 6, 7].map(k => a.camera.project(p.x + 2 * Math.cos(k * Math.PI / 4), .05, p.z + 2 * Math.sin(k * Math.PI / 4)));
    const heads = ids.map(id => { const t = a.getEntity(id)!.transform; return { head: a.camera.project(t.x, t.y + .75, t.z), feet: a.camera.project(t.x, t.y - .7, t.z) }; });
    return { ring, heads, lighting: a.perf().lighting, pools: a.lights.state() };
  });
  expect(setup.lighting!.preset).toBe('night');
  const image = await shot(page, 'night-street');
  await page.evaluate(async () => { window.__SS__!.settings.set({ idPass: true }); await window.__SS__!.screenshotReady(); });
  const mask = PNG.sync.read(await page.locator('canvas').screenshot({ path: `${out}/night-street-player-mask.png` }));
  await page.evaluate(async () => { window.__SS__!.settings.set({ idPass: false }); await window.__SS__!.screenshotReady(); });
  let sum = 0, n = 0;
  for (let i = 0; i < mask.data.length; i += 4) if (mask.data[i] > 240 && mask.data[i + 1] < 20 && mask.data[i + 2] > 240) { sum += lum(image.data[i], image.data[i + 1], image.data[i + 2]); n++; }
  // Ring samples hidden behind the survivor's own silhouette are not part of its surroundings.
  const covered = (ndc: number[]) => { const i = (Math.round((1 - ndc[1]) / 2 * mask.height) * mask.width + Math.round((ndc[0] + 1) / 2 * mask.width)) * 4; return mask.data[i] > 240 && mask.data[i + 1] < 20; };
  const ringPatches = setup.ring.filter(p => !covered(p)).map(p => patch(image, p, 5)), player = sum / n, ring = ringPatches.reduce((s, v) => s + v.l, 0) / ringPatches.length;
  const contrast = (player + .05) / (ring + .05);
  // Eyes: inside each infected's head box, the brightest pixel is red-dominant.
  const eyes = setup.heads.map(({ head, feet }) => {
    const x0 = Math.round((head[0] + 1) / 2 * image.width), y0 = Math.round((1 - head[1]) / 2 * image.height), y1 = Math.round((1 - feet[1]) / 2 * image.height), half = Math.max(8, Math.round((y1 - y0) * .45));
    let best = { l: -1, r: 0, g: 0, b: 0 };
    for (let y = y0 - half; y <= y1; y++) for (let x = x0 - half; x <= x0 + half; x++) { const i = (y * image.width + x) * 4, l = lum(image.data[i], image.data[i + 1], image.data[i + 2]); if (l > best.l) best = { l, r: image.data[i], g: image.data[i + 1], b: image.data[i + 2] }; }
    return best;
  });
  writeFileSync(`${out}/night-readability.json`, JSON.stringify({ playerPixels: n, player, ring, contrast, ringPatches, ringNdc: setup.ring, eyes, lighting: setup.lighting, pools: setup.pools }, null, 2) + '\n');
  expect(n).toBeGreaterThan(800);
  expect(contrast).toBeGreaterThanOrEqual(3);
  // Bloomed eye centres saturate towards pink-white; the brightest pixel must still be clearly red (hue 330-20°).
  for (const eye of eyes) { expect(eye.r - Math.max(eye.g, eye.b)).toBeGreaterThanOrEqual(60); const h = hue(eye.r, eye.g, eye.b); expect(h >= 330 || h <= 20).toBe(true); }
});

test('T-E25-06 @E25 @E25-AC06 hero shadow: under a promoted hero lamp the survivor shadow is >=35% darker than beside it and tinted, not black', async ({ page }) => {
  test.setTimeout(180_000);
  await boot(page);
  const probe = await page.evaluate(async (spot) => {
    const a = window.__SS__!; await a.loadLevel('night-street'); a.pause(); a.cheats.god(true);
    a.teleport('player', spot); a.camera.follow(); await a.step(20); await a.screenshotReady();
    const lighting = a.getState().render.lighting!, p = a.getEntity(1)!.transform, d = lighting.shadowDirection as number[];
    const h = Math.hypot(d[0], d[2]), ax = -d[0] / h, az = -d[2] / h;
    // Behind: along the cast direction, past the feet. Beside: the same distance, perpendicular, still inside the pool.
    return { lighting, perf: a.perf().lighting, behind: a.camera.project(p.x + ax * .9, .03, p.z + az * .9), beside: a.camera.project(p.x - az * .9, .03, p.z + ax * .9) };
  }, lampSpot);
  const image = await shot(page, 'hero-shadow');
  const behind = patch(image, probe.behind, 4), beside = patch(image, probe.beside, 4);
  writeFileSync(`${out}/hero-shadow.json`, JSON.stringify({ ...probe, behindColor: behind, besideColor: beside, darker: 1 - behind.l / beside.l, hue: hue(behind.r, behind.g, behind.b) }, null, 2) + '\n');
  expect(probe.perf!.heroShadow).toBe(1); expect(probe.perf!.shadowMaps).toBe(1);
  expect(1 - behind.l / beside.l).toBeGreaterThanOrEqual(.35);
  const h = hue(behind.r, behind.g, behind.b); expect(h).toBeGreaterThanOrEqual(230); expect(h).toBeLessThanOrEqual(290);
});
