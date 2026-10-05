import { expect, test, testUrl } from './fixtures';

/** Opt-in headed, real-GPU proof; SwiftShader goldens never run through this project. */
test('T-E02-01b @E02 @E02-AC01 an available native GPU selects WebGPU and renders lookdev', async ({ page }) => {
  await page.goto(testUrl.replace('&renderer=webgl', ''));
  await page.waitForFunction(() => Boolean(window.__SS__));
  const result = await page.evaluate(async () => {
    const api = window.__SS__!; await api.ready; api.pause();
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
    const available = Boolean(gpu && await gpu.requestAdapter());
    await api.loadScenario('lookdev'); api.pause(); await api.step(60); await api.screenshotReady();
    return { available, backend: api.getState().render.backend, perf: api.perf() };
  });
  expect(result.available, 'Requires a headed browser with a real WebGPU adapter').toBe(true);
  expect(result.backend).toBe('webgpu'); expect(result.perf.backend).toBe('webgpu'); expect(result.perf.drawCalls).toBeGreaterThan(1);
  await page.screenshot({ path: 'test-results/epics/E02/webgpu.png' });
});
