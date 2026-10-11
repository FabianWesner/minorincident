import { mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { boot, expect, test } from '../e2e/fixtures';
import type { SceneSpec } from '../../src/debug/scenelab/spec';

const out = 'test-results/epics/E27';
const luminance = (r: number, g: number, b: number) => {
  const linear = (v: number) => v / 255 <= .04045 ? v / 255 / 12.92 : ((v / 255 + .055) / 1.055) ** 2.4;
  return .2126 * linear(r) + .7152 * linear(g) + .0722 * linear(b);
};

test('T-E27-11 @E27 @E27-AC11 a night fire lights the lower column orange and a police strobe lights its smoke', async ({ page }) => {
  await boot(page, '/?test=1&scenelab&renderer=webgl&quality=high&audio=muted&dpr=1');
  const scene: SceneSpec = {
    name: 'smoke-lighting-proof', ground: 'asphalt', size: 50, time: 'night', dof: false,
    actors: [{ id: 'courier', kind: 'courier', at: [15, -15] }],
    camera: { mode: 'pose', position: [14, 12, 14], target: [0, 5, 0] },
    script: [{ frame: 0, effect: { hazard: 'fire', at: [0, 0], radius: 1.3, duration: 30 } }],
  };
  await page.evaluate(async s => { await window.__SCENE__!.load(s); await window.__SCENE__!.step(600); }, scene);
  const bands = await page.evaluate(() => ({ lower: window.__SS__!.camera.project(.5, 2.5, .25), upper: window.__SS__!.camera.project(2.5, 9, 1.2) }));
  await page.evaluate(() => window.__SS__!.screenshotReady()); mkdirSync(out, { recursive: true });
  const fire = PNG.sync.read(await page.locator('canvas').screenshot({ path: `${out}/ac11-fire-column.png` }));
  await page.evaluate(async () => { window.__SS__!.settings.set({ vfx: false }); await window.__SS__!.screenshotReady(); });
  const background = PNG.sync.read(await page.locator('canvas').screenshot());
  const band = (point: number[]) => {
    const cx = Math.round((point[0] + 1) * .5 * fire.width), cy = Math.round((1 - point[1]) * .5 * fire.height);
    let r = 0, g = 0, b = 0, lum = 0, pixels = 0;
    for (let y = cy - 25; y <= cy + 25; y++) for (let x = cx - 30; x <= cx + 30; x++) {
      const i = (y * fire.width + x) * 4;
      if (x < 0 || y < 0 || x >= fire.width || y >= fire.height || Math.abs(fire.data[i] - background.data[i]) + Math.abs(fire.data[i + 1] - background.data[i + 1]) + Math.abs(fire.data[i + 2] - background.data[i + 2]) < 12) continue;
      r += fire.data[i]; g += fire.data[i + 1]; b += fire.data[i + 2]; lum += luminance(fire.data[i], fire.data[i + 1], fire.data[i + 2]); pixels++;
    }
    r /= pixels; g /= pixels; b /= pixels;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
    const hue = ((max === r ? (g - b) / delta : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4) * 60 + 360) % 360;
    return { pixels, hue, luminance: lum / pixels };
  };
  const lower = band(bands.lower), upper = band(bands.upper);
  writeFileSync(`${out}/ac11-fire-lighting.json`, JSON.stringify({ lower, upper, bands }, null, 2));
  expect(lower.pixels).toBeGreaterThan(100); expect(upper.pixels).toBeGreaterThan(100);
  expect(lower.hue).toBeGreaterThanOrEqual(15); expect(lower.hue).toBeLessThanOrEqual(45);
  expect(lower.luminance).toBeGreaterThanOrEqual(upper.luminance * 2);
  // Use the real emergency vehicle's authored beacon anchors, not a synthetic screen flash.
  const beaconScene: SceneSpec = { ...scene, vehicles: [{ asset: 'vehicle.police', at: [0, 0] }],
    script: [{ frame: 0, effect: { hazard: 'tear-gas', at: [0, 0], radius: 3, duration: 30 } }],
  };
  const beaconId = await page.evaluate(async s => { window.__SS__!.settings.set({ vfx: true }); await window.__SCENE__!.load({ ...s, script: [] }); await window.__SCENE__!.step(180); return window.__SS__!.query({ kind: 'vehicle' })[0].id; }, beaconScene);
  // Disabling VFX clears its pools, so capture both clean beacon phases before
  // loading the cloud rather than destroying it between temporal samples.
  const backgrounds = new Map<boolean, PNG>();
  for (let i = 0; i < 2; i++) {
    await page.evaluate(() => window.__SS__!.screenshotReady());
    const tick = await page.evaluate(() => window.__SS__!.tick());
    backgrounds.set(Math.floor(tick / 30 + beaconId * 3.1) % 2 === 0, PNG.sync.read(await page.locator('canvas').screenshot()));
    if (i === 0) await page.evaluate(() => window.__SCENE__!.step(30));
  }
  await page.evaluate(async s => { await window.__SCENE__!.load(s); await window.__SCENE__!.step(180); }, beaconScene);
  const samples: { tick: number; luminance: number; pixels: number }[] = [];
  for (let n = 0; n < 60; n += 5) {
    await page.evaluate(async () => { await window.__SCENE__!.step(5); await window.__SS__!.screenshotReady(); });
    const png = PNG.sync.read(await page.locator('canvas').screenshot());
    const p = await page.evaluate(() => ({ tick: window.__SS__!.tick(), point: window.__SS__!.camera.project(0, 3, 0) }));
    const on = Math.floor(p.tick / 30 + beaconId * 3.1) % 2 === 0;
    const background = backgrounds.get(on)!;
    if (n === 0) {
      writeFileSync(`${out}/ac11-siren-full.png`, PNG.sync.write(png));
      writeFileSync(`${out}/ac11-siren-background.png`, PNG.sync.write(background));
      writeFileSync(`${out}/ac11-siren-state.json`, JSON.stringify(await page.evaluate(() => ({ ...window.__SS__!.getState().render.vfx!.blasts, lighting: window.__SS__!.getState().render.lighting, camera: window.__SS__!.getState().render.camera })), null, 2));
    }
    const cx = Math.round((p.point[0] + 1) * .5 * png.width), cy = Math.round((1 - p.point[1]) * .5 * png.height);
    let sum = 0, pixels = 0;
    for (let y = cy - 15; y <= cy + 15; y++) for (let x = cx - 20; x <= cx + 20; x++) {
      const i = (y * png.width + x) * 4;
      if (Math.abs(png.data[i] - background.data[i]) + Math.abs(png.data[i + 1] - background.data[i + 1]) + Math.abs(png.data[i + 2] - background.data[i + 2]) < 12) continue;
      sum += luminance(png.data[i], png.data[i + 1], png.data[i + 2]); pixels++;
    }
    expect(pixels, 'sample actual smoke rather than the beacon or empty background').toBeGreaterThan(100);
    if (n === 0 || n === 25) writeFileSync(`${out}/ac11-strobe-${on ? 'on' : 'off'}.png`, PNG.sync.write(png));
    samples.push({ tick: p.tick, luminance: sum / pixels, pixels });
  }
  const on = samples.filter(s => Math.floor(s.tick / 30 + beaconId * 3.1) % 2 === 0), off = samples.filter(s => !on.includes(s));
  const mean = (a: typeof samples) => a.reduce((sum, s) => sum + s.luminance, 0) / a.length;
  writeFileSync(`${out}/ac11-strobe.json`, JSON.stringify({ beaconId, samples, onMean: mean(on), offMean: mean(off), ratio: mean(on) / mean(off) }, null, 2));
  expect(on.length).toBeGreaterThan(0); expect(off.length).toBeGreaterThan(0); expect(mean(on)).toBeGreaterThan(mean(off) * 1.15);
});

test('T-E27-12 @E27 @E27-AC12 smoke covering the player retains a 2:1 silhouette at night', async ({ page }) => {
  mkdirSync(out, { recursive: true }); await boot(page);
  const setup = await page.evaluate(async () => {
    const a = window.__SS__!; await a.loadScenario('smoke-lab'); a.pause(); a.cheats.god(true);
    a.settings.set({ timeOfDay: 'night', cameraShake: false, aimAssist: 'Off' });
    a.setLoadout(['weapon.pistol'], ['weapon.smoke-grenade']);
    a.input.set({ aim: { x: 1, z: 0 }, aimPoint: { x: 1, z: 0 }, right: { down: true, held: true, up: false } });
    await a.step(1); a.input.clear(); a.camera.follow();
    for (let i = 0; i < 120; i++) { await a.step(1); a.vfx.stepRender(1 / 60); }
    await a.screenshotReady();
    const p = a.getEntity(1)!.transform, zones = a.getState().combat!.zones ?? [];
    const ring = Array.from({ length: 8 }, (_, i) => a.camera.project(p.x + 2 * Math.cos(i * Math.PI / 4), .02, p.z + 2 * Math.sin(i * Math.PI / 4)));
    return { ring, zones, p, vfx: a.getState().render.vfx!.blasts };
  });
  expect(setup.vfx.clouds).toBe(1);
  const image = PNG.sync.read(await page.locator('canvas').screenshot({ path: `${out}/ac12-smoke-player.png` }));
  await page.evaluate(async () => { const a = window.__SS__!; a.settings.set({ vfx: false, idPass: true }); await a.screenshotReady(); });
  const mask = PNG.sync.read(await page.locator('canvas').screenshot({ path: `${out}/ac12-player-mask.png` }));
  await page.evaluate(async () => { window.__SS__!.settings.set({ idPass: false }); await window.__SS__!.screenshotReady(); });
  const clear = PNG.sync.read(await page.locator('canvas').screenshot());
  let sum = 0, pixels = 0, covered = 0;
  for (let i = 0; i < mask.data.length; i += 4) if (mask.data[i] > 240 && mask.data[i + 1] < 20 && mask.data[i + 2] > 240) {
    sum += luminance(image.data[i], image.data[i + 1], image.data[i + 2]); pixels++;
    if (Math.abs(image.data[i] - clear.data[i]) + Math.abs(image.data[i + 1] - clear.data[i + 1]) + Math.abs(image.data[i + 2] - clear.data[i + 2]) > 12) covered++;
  }
  const ring = setup.ring.map(p => {
    const cx = Math.round((p[0] + 1) * .5 * image.width), cy = Math.round((1 - p[1]) * .5 * image.height);
    let sum = 0, n = 0;
    for (let y = cy - 4; y <= cy + 4; y++) for (let x = cx - 4; x <= cx + 4; x++) {
      if (x < 0 || y < 0 || x >= image.width || y >= image.height) continue;
      const i = (y * image.width + x) * 4;
      if (mask.data[i] > 240 && mask.data[i + 1] < 20 && mask.data[i + 2] > 240) continue;
      sum += luminance(image.data[i], image.data[i + 1], image.data[i + 2]); n++;
    }
    return n ? sum / n : null;
  }).filter((v): v is number => v !== null);
  const player = sum / pixels, surrounding = ring.reduce((sum, v) => sum + v, 0) / ring.length;
  const contrast = (player + .05) / (surrounding + .05);
  const smokeCoverage = covered / pixels;
  writeFileSync(`${out}/ac12-readability.json`, JSON.stringify({ ...setup, pixels, player, surrounding, contrast, smokeCoverage, ring }, null, 2));
  expect(pixels).toBeGreaterThan(800); expect(ring.length).toBeGreaterThan(4);
  expect(setup.zones.some(z => z.kind === 'smoke' && Math.hypot(z.x - setup.p.x, z.z - setup.p.z) < z.radius)).toBe(true);
  expect(contrast).toBeGreaterThanOrEqual(2);
  expect(smokeCoverage).toBeGreaterThan(.01); expect(smokeCoverage).toBeLessThanOrEqual(.4);
});
