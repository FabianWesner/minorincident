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

const meanLuminance = (png: PNG) => { let s = 0, n = 0; for (let i = 0; i < png.data.length; i += 16) { s += lum(png.data, i); n++; } return s / n; };
test('T-E27-07 @E27 @E27-AC07 flash reduction keeps the full-screen luminance delta per frame ≤ 20 % for every blast class', async ({ page }) => {
  test.setTimeout(180_000);
  const result: Record<string, number> = {};
  for (const [cls, id] of [['small', 'explosion.pipe-bomb'], ['medium', 'explosion.propane'], ['large', 'explosion.car'], ['mega', 'explosion.gas-tanks']] as const) {
    await lab(page, { flashReduction: true });
    let previous = meanLuminance(await shot(page)), worst = 0;
    await page.evaluate(id => window.__SS__!.explosions.blast(id, { x: 0, z: 0 }), id);
    for (let frame = 0; frame < 14; frame++) {
      await page.evaluate(async f => { const a = window.__SS__!; if (f) { await a.step(1); a.vfx.stepRender(1 / 60); } await a.screenshotReady(); }, frame);
      const png = await shot(page, frame === 3 ? `${out}/ac07-${cls}-reduced.png` : undefined), l = meanLuminance(png);
      worst = Math.max(worst, Math.abs(l - previous)); previous = l;
    }
    result[cls] = worst;
  }
  writeFileSync(`${out}/ac07-flash.json`, JSON.stringify(result, null, 2));
  for (const [cls, delta] of Object.entries(result)) expect(delta, cls).toBeLessThanOrEqual(.2);
});

test('T-E27-05v @E27 @E27-AC05 car explosion: wreck jumps, panels fly, burned variant, smoke column persists ≥ 20 s', async ({ page }) => {
  test.setTimeout(120_000);
  await lab(page);
  await page.evaluate(async () => {
    const a = window.__SS__!, id = a.query({ kind: 'vehicle' })[0].id; a.teleport('player', { x: -8, z: 10 }); a.camera.preset('blast-car');
    a.explosions.wreck(id); await a.step(180); for (let i = 0; i < 8; i++) { await a.step(1); a.vfx.stepRender(1 / 60); } await a.screenshotReady();
  });
  await page.screenshot({ path: `${out}/ac05-car-blast.png` });
  const mid = await page.evaluate(async () => { const a = window.__SS__!; for (let i = 0; i < 40; i++) { await a.step(1); a.vfx.stepRender(1 / 60); } await a.screenshotReady(); return { parts: a.explosions.state()!.parts.length, damage: a.getEntity(a.query({ kind: 'vehicle' })[0].id)!.vehicle!.damage }; });
  await page.screenshot({ path: `${out}/ac05-car-parts.png` });
  expect(mid.parts).toBeGreaterThanOrEqual(2); expect(mid.damage).toBe('exploded');
  // 20 s later the wreck still burns and its column still rises.
  const late = await page.evaluate(async () => { const a = window.__SS__!; a.camera.preset('blast-car'); for (let i = 0; i < 20 * 15; i++) { await a.step(4); a.vfx.stepRender(4 / 60); } await a.screenshotReady(); return a.getState().render.vfx!.blasts; });
  await page.screenshot({ path: `${out}/ac05-wreck-20s.png` });
  expect(late.columns).toBeGreaterThanOrEqual(1); expect(late.puffs).toBeGreaterThan(20);
});

test('T-E27-08v @E27 @E27-AC08 smoke grenade cloud reads at the game camera and dissipates with the zone', async ({ page }) => {
  test.setTimeout(90_000);
  await boot(page);
  const state = await page.evaluate(async () => {
    const a = window.__SS__!; await a.loadScenario('smoke-lab', { seed: 1 }); a.pause(); a.cheats.god(true); a.settings.set({ cameraShake: false, aimAssist: 'Off', vfx: true });
    for (let i = 0; i < 6; i++) a.spawn('infected.runner', { x: 3 + i * .5, z: -2 + i * .4 }, { state: 'chase' });
    a.setLoadout(['weapon.pistol'], ['weapon.smoke-grenade']);
    a.input.set({ aim: { x: 1, z: 0 }, aimPoint: { x: 1.5, z: 0 }, right: { down: true, held: true, up: false } }); await a.step(1); a.input.clear();
    a.camera.preset('blast'); for (let i = 0; i < 90; i++) { await a.step(1); a.vfx.stepRender(1 / 60); } await a.screenshotReady();
    return { blasts: a.getState().render.vfx!.blasts, lost: a.events(0).filter(e => e.type === 'ai.lostTarget').length };
  });
  await page.screenshot({ path: `${out}/ac08-smoke-cloud.png` });
  expect(state.blasts.clouds).toBe(1); expect(state.blasts.puffs).toBeGreaterThan(15); expect(state.lost).toBeGreaterThanOrEqual(6);
  const after = await page.evaluate(async () => { const a = window.__SS__!; for (let i = 0; i < 20; i++) { await a.step(60); a.vfx.stepRender(1); } await a.screenshotReady(); return a.getState().render.vfx!.blasts; });
  expect(after.clouds).toBe(0); expect(after.puffs).toBe(0);
});

test('T-E27-14 @E27 @E27-AC14 mega + chain stays within particle/puff/debris caps and pools return to baseline 30 s after the last flame', async ({ page }) => {
  test.setTimeout(150_000);
  await lab(page, {}, 'blast-wide');
  const result = await page.evaluate(async () => {
    const a = window.__SS__!, base = a.getState().render.vfx!;
    for (let i = 0; i < 6; i++) a.spawn('hazard.propane', { x: -12 + i * 2.4, z: -27 }); // clear of the parked car: its wreck would burn on
    a.explosions.blast('explosion.gas-station', { x: -6, z: -22 }); let peak = { particles: 0, puffs: 0, fireballs: 0, debris: 0, parts: 0 };
    for (let i = 0; i < 90; i++) { await a.step(2); a.vfx.stepRender(2 / 60); const v = a.getState().render.vfx!, s = a.getState();
      peak = { particles: Math.max(peak.particles, v.particles), puffs: Math.max(peak.puffs, v.blasts.puffs), fireballs: Math.max(peak.fireballs, v.blasts.fireballs), debris: Math.max(peak.debris, s.interactions?.debris.length ?? 0), parts: Math.max(peak.parts, a.explosions.state()!.parts.length) }; }
    await a.screenshotReady();
    const caps = a.getState().render.vfx!;
    for (let i = 0; i < 120; i++) { await a.step(60); a.vfx.stepRender(1); }
    await a.screenshotReady();
    const end = a.getState().render.vfx!;
    return { base, peak, caps: { particleCap: caps.particleCap, puffCap: caps.blasts.puffCap, fireballCap: caps.blasts.fireballCap }, explosions: a.events(0).filter(e => e.type === 'explosion').length, end, fires: a.query({ archetype: 'hazard.fire' }).filter(e => a.tick() < e.hazard!.activeUntil).length };
  });
  writeFileSync(`${out}/ac14-budgets.json`, JSON.stringify(result, null, 2));
  expect(result.explosions).toBeGreaterThanOrEqual(5);
  expect(result.peak.particles).toBeLessThanOrEqual(result.caps.particleCap); expect(result.peak.puffs).toBeLessThanOrEqual(result.caps.puffCap);
  expect(result.peak.particles + result.peak.puffs).toBeLessThanOrEqual(6000); expect(result.peak.debris).toBeLessThanOrEqual(120); expect(result.peak.parts).toBeLessThanOrEqual(12);
  expect(result.fires).toBe(0);
  for (const key of ['particles', 'gibs'] as const) expect(result.end[key], key).toBeLessThanOrEqual(result.base[key]);
  expect(result.end.blasts).toMatchObject({ puffs: 0, fireballs: 0, flames: 0, glows: 0, columns: 0, clouds: 0, parts: 0 });
});
