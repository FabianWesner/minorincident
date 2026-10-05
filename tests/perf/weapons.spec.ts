import { mkdirSync, writeFileSync } from 'node:fs';
import { boot, expect, test } from '../e2e/fixtures';

test('T-E06-render-perf @E06 @perf held assets and indicators stay in render budget and unload cleanly', async ({ page }) => {
  test.setTimeout(120_000); await boot(page);
  const data = await page.evaluate(async () => {
    const api = window.__SS__!; await api.unloadScenario(); await api.screenshotReady(); const baseline = api.perf(), loads = [], unloads = [];
    for (let i = 0; i < 3; i++) {
      await api.loadScenario('combat-arena', { seed: 1 }); api.pause(); api.setLoadout(['weapon.hunting-rifle'], ['weapon.nail-bat']);
      for (let n = 0; n < 20; n++) api.spawn('infected.runner', { x: 3 + n % 5, z: Math.floor(n / 5) - 2 });
      api.input.set({ aim: { x: 1, z: 0 }, left: { held: true, down: true, up: false } }); await api.step(60); api.input.clear(); await api.screenshotReady(); loads.push(api.perf());
      await api.unloadScenario(); await api.screenshotReady(); unloads.push(api.perf());
    }
    return { baseline, loads, unloads, note: 'SwiftShader deterministic counters; hardware frame-time parity is a separate WebGPU check.' };
  });
  for (const perf of data.loads) { expect(perf.drawCalls).toBeLessThanOrEqual(600); expect(perf.triangles).toBeLessThanOrEqual(1_500_000); }
  for (const perf of data.unloads) { expect(perf.geometries).toBe(data.baseline.geometries); expect(perf.textures).toBe(data.baseline.textures); }
  expect(data.loads.map((p) => p.geometries)).toEqual([data.loads[0].geometries, data.loads[0].geometries, data.loads[0].geometries]);
  mkdirSync('test-results/epics/E06', { recursive: true }); writeFileSync('test-results/epics/E06/render-perf.json', JSON.stringify(data, null, 2));
});
