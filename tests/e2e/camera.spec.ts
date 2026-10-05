import { boot, expect, test, testUrl } from './fixtures';

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
  expect(Math.hypot(focuses[59][0] - 20, focuses[59][2])).toBeLessThan(0.01);
  for (const focus of focuses) { expect(focus[0]).toBeGreaterThanOrEqual(0); expect(focus[0]).toBeLessThanOrEqual(20.5); }
});
