import { mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { boot, expect, test, testUrl } from './fixtures';

function artifact(name: string, value: unknown): void { mkdirSync('test-results/epics/E02', { recursive: true }); writeFileSync(`test-results/epics/E02/${name}.json`, JSON.stringify(value, null, 2) + '\n'); }

test('T-E02-01 @E02 @E02-AC01 forced WebGL2 and automatic backend report the initialized backend', async ({ page }) => {
  await boot(page);
  expect(await page.evaluate(() => ({ state: window.__SS__!.getState().render.backend, perf: window.__SS__!.perf().backend }))).toEqual({ state: 'webgl', perf: 'webgl' });
  await page.goto(testUrl.replace('&renderer=webgl', ''));
  await page.waitForFunction(() => Boolean(window.__SS__));
  const result = await page.evaluate(async () => {
    await window.__SS__!.ready;
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
    const available = Boolean(gpu && await gpu.requestAdapter());
    return { available, state: window.__SS__!.getState().render.backend, perf: window.__SS__!.perf().backend };
  });
  artifact('backend', { forced: 'webgl', automatic: result });
  expect(result.state).toBe(result.available ? 'webgpu' : 'webgl'); expect(result.perf).toBe(result.state);
});

test('T-E02-03 @E02 @E02-AC03 follow converges after 20 m teleport without overshoot', async ({ page }) => {
  await boot(page);
  const focuses = await page.evaluate(async () => {
    const api = window.__SS__!; api.teleport('player', { x: 20, z: 0 });
    const points: number[][] = [];
    for (let i = 0; i < 60; i++) { await api.step(1); points.push(api.getState().render.camera.focus); }
    return points;
  });
  artifact('follow', { final: focuses[59], maxX: Math.max(...focuses.map((p) => p[0])), simSeconds: 1 });
  expect(Math.hypot(focuses[59][0] - 20, focuses[59][2])).toBeLessThan(0.01);
  for (const focus of focuses) { expect(focus[0]).toBeGreaterThanOrEqual(0); expect(focus[0]).toBeLessThanOrEqual(20.5); }
});

test('T-E02-02 @E02 @E02-AC02 default camera angles and projected 1.4 m survivor height', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const api = window.__SS__!; await api.loadScenario('lookdev'); api.pause();
    const top = api.camera.project(0, 1.4, 0), bottom = api.camera.project(0, 0, 0);
    return { camera: api.getState().render.camera, height: Math.abs(top[1] - bottom[1]) / 2 };
  });
  expect(result.camera.fov).toBe(25); expect(result.camera.azimuth).toBeCloseTo(Math.PI / 4, 2); expect(result.camera.polar).toBeCloseTo(Math.PI * 0.3, 2);
  expect(result.height).toBeGreaterThanOrEqual(1 / 14); expect(result.height).toBeLessThanOrEqual(1 / 10);
  await page.evaluate(() => window.__SS__!.settings.set({ idPass: true }));
  const image = PNG.sync.read(await page.screenshot({ path: 'test-results/epics/E02/player-height-mask.png' }));
  let minY = image.height, maxY = 0;
  for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
    const i = (y * image.width + x) * 4;
    if (image.data[i] > 240 && image.data[i + 1] < 20 && image.data[i + 2] > 240) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  }
  artifact('camera', { ...result, survivorPixelHeight: maxY - minY + 1, viewportHeight: image.height });
  expect((maxY - minY + 1) / image.height).toBeGreaterThanOrEqual(1 / 14);
  expect((maxY - minY + 1) / image.height).toBeLessThanOrEqual(1 / 10);
});

test('T-E02-04 @E02 @E02-AC04 portrait keeps every point of the 12 m circle inside the viewport', async ({ page }) => {
  await boot(page);
  const desktopRadius = await page.evaluate(() => window.__SS__!.getState().render.camera.radius);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => window.__SS__!.getState().render.camera.radius)).toBeGreaterThan(desktopRadius);
  const points = await page.evaluate(() => Array.from({ length: 360 }, (_, i) => window.__SS__!.camera.project(12 * Math.cos(i * Math.PI / 180), 0, 12 * Math.sin(i * Math.PI / 180))));
  for (const p of points) { expect(Math.abs(p[0])).toBeLessThan(1); expect(Math.abs(p[1])).toBeLessThan(1); expect(p[2]).toBeGreaterThan(-1); expect(p[2]).toBeLessThan(1); }
});

test('T-E02-05b @E02 @E02-AC05 lookdev only uses palette or explicitly retained materials', async ({ page }) => {
  await boot(page);
  const materials = await page.evaluate(async () => { await window.__SS__!.loadScenario('lookdev'); return window.__SS__!.getState().render.materials; });
  expect(materials.length).toBeGreaterThan(10);
  for (const material of materials) expect(material.palette || material.name.startsWith('keep_'), material.name).toBe(true);
});
