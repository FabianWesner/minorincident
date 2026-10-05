import { expect, test, testUrl } from './fixtures';
import { mkdirSync, writeFileSync } from 'node:fs';

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

test('T-E07-12-native @E07 @E07-AC12 native WebGPU renders the same instanced infected crowd', async ({ page }) => {
  await page.goto(testUrl.replace('&renderer=webgl', ''));
  await page.waitForFunction(() => Boolean(window.__SS__));
  const proof = await page.evaluate(async () => {
    const api = window.__SS__!; await api.ready; api.pause(); await api.loadScenario('horde-arena'); api.pause(); api.cheats.god(true);
    for (let i = 0; i < 200; i++) api.spawn('infected.runner', { x: i % 20 * 0.8 - 8, z: Math.floor(i / 20) * 0.8 - 4 }, { state: 'chase' });
    await api.step(30); await api.screenshotReady(); return { state: api.getState().render, perf: api.perf() };
  });
  expect(proof.state.backend).toBe('webgpu'); expect(proof.state.crowd!.meshDrawCalls).toBeLessThanOrEqual(30); expect(proof.state.crowd!.nonInstancedMeshes).toBe(0);
  expect(proof.state.crowd!.batches.find((b) => b.id === 'infected.runner')!.instances).toBe(200);
  mkdirSync('test-results/epics/E07', { recursive: true });
  await page.locator('canvas').screenshot({ path: 'test-results/epics/E07/webgpu.png' });
  writeFileSync('test-results/epics/E07/webgpu.json', JSON.stringify(proof, null, 2) + '\n');
});
