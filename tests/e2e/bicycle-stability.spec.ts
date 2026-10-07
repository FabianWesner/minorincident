import { readFileSync, writeFileSync } from 'node:fs';
import { Quaternion } from 'three';
import { inside } from '../../src/levels/districts/validate';
import type { DistrictLayout } from '../../src/levels/districts/types';
import { boot, test, expect, testUrl } from './fixtures';

const layout = JSON.parse(readFileSync('public/assets/layouts/D-GROVE.layout.json', 'utf8')) as DistrictLayout;
for (const skin of [0, 1]) test(`bike skin=${skin} mounts level on the start sidewalk and rider follows a 90 degree turn @E19`, async ({ page }, info) => {
  await boot(page, `${testUrl}&skin=${skin}`);
  const mounted = await page.evaluate(async () => {
    const a = window.__SS__!; await a.loadLevel('L1', { seed: 1 }); a.pause();
    const bike = a.getState().entities.find(e => e.bicycle)!;
    a.teleport('player', { x: bike.transform.x + .9, z: bike.transform.z }); a.input.set({ interact: true }); await a.step(1); a.input.set({ interact: false }); await a.step(40);
    return a.getState();
  });
  expect(mounted.entities.find(e => e.bicycle)!.bicycle!.mounted).toBe(true);
  expect(mounted.render.character!.clip).toBe('ride');
  expect(mounted.render.character!.skinned).toBe(skin === 1);
  const bike = mounted.render.bicycle!;
  expect(layout.surfaces.some(s => s.surface === 'tile' && bike.wheels.every(p => p && inside([p[0], p[2]], s.polygon)))).toBe(true);
  for (const p of bike.wheels) expect(p![1]).toBeCloseTo(.13, 3);
  const hip = mounted.render.character!.pelvis!;
  expect(Math.hypot(hip[0] - bike.seat![0], hip[1] - bike.seat![1] + .04, hip[2] - bike.seat![2])).toBeLessThan(.01);
  const frames = await page.evaluate(async () => {
    const a = window.__SS__!; a.teleport('player', { x: -40, z: 0 });
    a.input.set({ move: { x: 1, z: 0 } });
    const frames = [];
    for (let i = 0; i < 180; i++) { await a.step(1); const s = a.getState(); frames.push({ bike: s.entities.find(e => e.bicycle)!, view: s.render.bicycle!, rider: s.render.character! }); }
    a.input.set({ move: { x: 0, z: 0 } }); return frames;
  });
  writeFileSync(info.outputPath('bike-turn.json'), JSON.stringify(frames, null, 2));
  expect(Math.abs(frames.at(-1)!.bike.transform.yaw - frames[0].bike.transform.yaw)).toBeGreaterThan(Math.PI / 2 - .1);
  for (const f of frames) {
    expect(f.bike.bicycle!.mounted).toBe(true);
    const rider = new Quaternion().fromArray(f.rider.orientation), frame = new Quaternion().fromArray(f.view.orientation);
    expect(rider.angleTo(frame) * 180 / Math.PI).toBeLessThan(1);
    expect(Math.abs(Math.atan2(Math.sin(f.rider.yaw - f.bike.transform.yaw), Math.cos(f.rider.yaw - f.bike.transform.yaw))) * 180 / Math.PI).toBeLessThan(1);
  }
  // Fractional render frames also use the bike's current frame, without a separate facing lag.
  const live = await page.evaluate(async () => {
    const a = window.__SS__!; a.input.set({ move: { x: 0, z: 1 } }); a.resume();
    const start = performance.now(), frames = [];
    while (performance.now() - start < 3000) { await new Promise<void>(resolve => requestAnimationFrame(() => resolve())); const s = a.getState(); frames.push({ bike: s.render.bicycle!, rider: s.render.character! }); }
    a.pause(); return frames;
  });
  writeFileSync(info.outputPath('bike-turn-live.json'), JSON.stringify(live, null, 2));
  for (const f of live) expect(new Quaternion().fromArray(f.rider.orientation).angleTo(new Quaternion().fromArray(f.bike.orientation)) * 180 / Math.PI).toBeLessThan(1);
});

test.describe('bike ACTION after the garage bat', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  test('touch ACTION remains enabled for remount after the bat objective @E19', async ({ page }) => {
    const { menuStart } = await import('./ui-helpers');
    await menuStart(page); await page.evaluate(async () => {
      const a = window.__SS__!; a.pause();
      for (const id of ['pickup', 'deliver', 'escape']) a.missions.completeObjective(id);
      a.teleport('player', { x: 23.1, z: 38.289 }); a.input.set({ interact: true }); await a.step(1); a.input.set({ interact: false }); await a.step(360);
      const bike = a.getState().entities.find(e => e.bicycle)!;
      a.teleport('player', { x: bike.transform.x + .9, z: bike.transform.z }); await a.step(1);
    });
    expect(await page.evaluate(() => window.__SS__!.missions.state()!.steps.weapon.status)).toBe('completed');
    await expect(page.getByTestId('touch-interact')).toBeEnabled();
    await page.getByTestId('touch-interact').tap(); await page.evaluate(() => window.__SS__!.step(1));
    expect(await page.evaluate(() => window.__SS__!.getState().entities.find(e => e.bicycle)!.bicycle!.mounted)).toBe(true);
  });
});
