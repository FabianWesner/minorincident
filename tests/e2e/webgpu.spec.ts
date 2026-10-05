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

test('T-E11-webgpu @E11 @E11-AC09 native WebGPU renders the interaction ring and prompt within the district draw budget', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(testUrl.replace('&renderer=webgl', ''));
  await page.waitForFunction(() => Boolean(window.__SS__));
  const metrics = await page.evaluate(async () => {
    const api = window.__SS__!; await api.ready; await api.loadLevel('D-RES', { tier: 5 }); api.pause();
    const p = api.getState().player!.transform;
    api.spawn('device.generator', { x: p.x, z: p.z + 1 }, { fuel: 20, holdTime: 4, label: 'Start generator' });
    await api.step(90); api.camera.preset('interact-ui'); await api.screenshotReady();
    const frames: number[] = []; let previous = performance.now();
    for (let i = 0; i < 120; i++) await new Promise<void>(resolve => requestAnimationFrame(now => { frames.push(now - previous); previous = now; resolve(); }));
    frames.sort((a, b) => a - b);
    return { ...api.perf(), rafMsMedian: frames[60], rafMsP95: frames[114], frames: frames.length };
  });
  expect(metrics.backend).toBe('webgpu'); expect(metrics.drawCalls).toBeLessThanOrEqual(250);
  await expect(page.getByTestId('interaction-prompt')).toContainText('Start generator');
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '38');
  mkdirSync('test-results/epics/E11', { recursive: true });
  writeFileSync('test-results/epics/E11/native-perf.json', JSON.stringify(metrics, null, 2) + '\n');
  await page.screenshot({ path: 'test-results/epics/E11/interact-ui-W5-webgpu.png' });
});

test('T-E06-webgpu @E06 headed native WebGPU renders catalog attachments and selected telegraphs', async ({ page }) => {
  await page.goto(testUrl.replace('&renderer=webgl', '')); await page.waitForFunction(() => Boolean(window.__SS__));
  const result = await page.evaluate(async () => {
    const api = window.__SS__!; await api.ready; await api.loadScenario('combat-arena', { seed: 1 }); api.pause(); api.camera.preset('aim');
    const states = [];
    for (const id of ['weapon.pistol', 'weapon.bat', 'weapon.grenade']) {
      api.setLoadout([id], [id]); api.input.set({ aim: { x: 1, z: 0 }, aimPoint: { x: 8, z: 0 } }); await api.step(1); api.input.clear(); await api.screenshotReady(); states.push(api.getState().render.actions!);
    }
    return { backend: api.getState().render.backend, states, perf: api.perf() };
  });
  expect(result.backend).toBe('webgpu'); expect(result.states.map((s) => s.indicator.shape)).toEqual(['line', 'cone', 'arc']);
  for (const state of result.states) for (const attachment of state.attachments) { expect(attachment.attached).toBe(true); expect(attachment.handDistance).toBeLessThanOrEqual(0.05); }
  expect(result.perf.drawCalls).toBeLessThanOrEqual(600); expect(result.perf.triangles).toBeLessThanOrEqual(1_500_000);
  const { mkdirSync, writeFileSync } = await import('node:fs'); mkdirSync('test-results/epics/E06', { recursive: true });
  writeFileSync('test-results/epics/E06/webgpu.json', JSON.stringify(result, null, 2)); await page.screenshot({ path: 'test-results/epics/E06/webgpu.png' });
});
