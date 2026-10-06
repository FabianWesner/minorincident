import { mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { boot, expect, test } from '../e2e/fixtures';
const output = 'test-results/epics/E09';
test('T-E09-10 @E09-AC10 wheel spin/steer, brake lamps and alternating siren pixels', async ({ page }) => {
  mkdirSync(output, { recursive: true }); await boot(page);
  await page.evaluate(async () => { const a = window.__SS__!; await a.loadScenario('drive-course'); a.pause(); a.teleport('player', { x: .2, z: 13.45 }); await a.step(36); a.camera.preset('vehicle'); await a.screenshotReady(); });
  const first = await page.evaluate(() => window.__SS__!.getState().render.vehicles.find(v => v.id === 3)!);
  const capture = async (name: string) => { await page.evaluate(async () => { await window.__SS__!.screenshotReady(); }); const png = PNG.sync.read(await page.screenshot({ path: `${output}/${name}.png` })); await expect(page).toHaveScreenshot(`vehicle-${name}.png`, { threshold: .1, maxDiffPixelRatio: .015 }); return png; };
  const brakePoint = async () => page.evaluate(() => { const a = window.__SS__!, p = a.getEntity(3)!.transform; return a.camera.project(p.x - Math.cos(p.yaw) * 2.1, p.y - .79 + .8, p.z + Math.sin(p.yaw) * 2.1); });
  const firstBrake = await brakePoint();
  const on = await capture('brake-siren-right');
  await page.evaluate(async () => { const a = window.__SS__!; a.input.set({ aimPoint: { x: 10, z: 16 }, left: { down: true, held: true, up: false } }); await a.step(30); });
  const second = await page.evaluate(() => window.__SS__!.getState().render.vehicles.find(v => v.id === 3)!);
  expect(Math.abs(second.wheels[0].spin - first.wheels[0].spin)).toBeGreaterThan(.5);
  expect(Math.abs(second.wheels[0].steer)).toBeGreaterThan(.05); expect(second.wheels[2].steer).toBe(0); expect(first.brake).toBeGreaterThan(second.brake * 10);
  const secondBrake = await brakePoint(), moving = await capture('driving-wheels');
  function redPixels(png: PNG, point: number[]) { const cx = Math.round((point[0] + 1) / 2 * png.width), cy = Math.round((1 - point[1]) / 2 * png.height); let count = 0; for (let y = cy - 8; y <= cy + 8; y++) for (let x = cx - 20; x <= cx + 20; x++) { const i = (y * png.width + x) * 4; if (png.data[i] > 180 && png.data[i] > png.data[i+1] * 1.3 && png.data[i] > png.data[i+2] * 1.3) count++; } return count; }
  const brakeOnPixels = redPixels(on, firstBrake), brakeOffPixels = redPixels(moving, secondBrake);
  expect(brakeOnPixels).toBeGreaterThan(30); expect(brakeOffPixels).toBeLessThan(brakeOnPixels / 3);
  // Freeze the same chassis/camera and switch only the lamp phase by loading a fresh stationary fixture.
  await page.evaluate(async () => { const a = window.__SS__!; await a.loadScenario('drive-course'); a.pause(); a.teleport('player', { x: .2, z: 13.45 }); await a.step(66); a.camera.preset('vehicle'); await a.screenshotReady(); });
  const off = await capture('brake-siren-left');
  const points = await page.evaluate(() => { const a = window.__SS__!; return { left: a.camera.project(0, 1.68, 12.3), right: a.camera.project(0, 1.68, 11.7), brake: a.camera.project(-2.1, .8, 12) }; });
  function patchDifference(point: number[]) { const cx = Math.round((point[0] + 1) / 2 * on.width), cy = Math.round((1 - point[1]) / 2 * on.height); let changed = 0; for (let y = cy - 12; y <= cy + 12; y++) for (let x = cx - 12; x <= cx + 12; x++) { const i = (y * on.width + x) * 4; if (Math.abs(on.data[i] - off.data[i]) + Math.abs(on.data[i+1] - off.data[i+1]) + Math.abs(on.data[i+2] - off.data[i+2]) > 30) changed++; } return changed; }
  const leftPixels = patchDifference(points.left), rightPixels = patchDifference(points.right);
  expect(leftPixels).toBeGreaterThan(15); expect(rightPixels).toBeGreaterThan(15);
  const perf = await page.evaluate(() => window.__SS__!.perf()); expect(perf.drawCalls).toBeLessThanOrEqual(600); expect(perf.triangles).toBeLessThanOrEqual(1_500_000); writeFileSync(`${output}/render-perf.json`, JSON.stringify(perf, null, 2));
  writeFileSync(`${output}/visual-metrics.json`, JSON.stringify({ first, second, leftPixels, rightPixels, brakeOnPixels, brakeOffPixels }, null, 2));
});
