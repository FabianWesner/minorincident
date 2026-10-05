import { mkdirSync, writeFileSync } from 'node:fs';
import { boot, expect, test } from '../e2e/fixtures';

test('T-E02-perf @E02 @perf lookdev counters, frame costs and lifecycle plateau', async ({ page }) => {
  test.setTimeout(120_000);
  await boot(page);
  const result = await page.evaluate(async () => {
    const api = window.__SS__!; await api.unloadScenario(); await api.screenshotReady();
    const baseline = api.perf(), loads: ReturnType<typeof api.perf>[] = [], unloads: ReturnType<typeof api.perf>[] = [];
    const samples: number[] = [];
    for (let i = 0; i < 3; i++) {
      await api.loadScenario('lookdev', { seed: 1 }); api.pause(); await api.step(60); await api.screenshotReady(); loads.push(api.perf());
      if (i === 0) for (let n = 0; n < 10; n++) { const start = performance.now(); await api.step(1); samples.push(performance.now() - start); }
      await api.unloadScenario(); await api.screenshotReady(); unloads.push(api.perf());
    }
    samples.sort((a, b) => a - b);
    return { baseline, loads, unloads, cpuSubmissionMedianMs: samples[5], cpuSubmissionP95Ms: samples[9], note: 'CPU submission timings only (asynchronous GPU work excluded); RAF frame counters are from paused SwiftShader captures, not a hardware FPS measurement.' };
  });
  for (const load of result.loads) { expect(load.drawCalls).toBeLessThan(250); expect(load.triangles).toBeLessThan(150_000); }
  for (const unload of result.unloads) { expect(unload.geometries).toBe(result.baseline.geometries); expect(unload.textures).toBe(result.baseline.textures); }
  expect(result.loads.map((p) => p.geometries)).toEqual([result.loads[0].geometries, result.loads[0].geometries, result.loads[0].geometries]);
  mkdirSync('test-results/epics/E02', { recursive: true }); writeFileSync('test-results/epics/E02/perf.json', JSON.stringify(result, null, 2) + '\n');
});
