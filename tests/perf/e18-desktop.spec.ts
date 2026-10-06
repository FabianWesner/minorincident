import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect } from '../e2e/fixtures';
// This local gate must run on headed Chrome with native GPU, under the same machine-wide lock.
test.use({ channel: 'chrome', headless: false, launchOptions: { args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] } });
test('T-E18-09 @E18-AC09 @perf local native-GPU Chrome high horde p95 frame <=16.7ms', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/?test=1&quality=high&audio=muted&dpr=1'); await page.waitForFunction(() => Boolean(window.__SS__)); await page.bringToFront();
  const proof = await page.evaluate(async () => {
    const a = window.__SS__!; await a.ready; await a.loadScenario('perf-horde-200'); a.cheats.god(true); a.camera.preset('perf-horde'); await a.screenshotReady(); a.resume();
    const adapter = await (navigator as Navigator & { gpu?: { requestAdapter(): Promise<{ info?: { vendor: string; architecture: string; device: string; description: string } } | null> } }).gpu?.requestAdapter();
    const frameMs: number[] = []; let previous = 0; const startTick = a.tick(), startFrame = a.perf().renderedFrames;
    for (let i = 0; i < 720; i++) { const now = await new Promise<number>(resolve => requestAnimationFrame(resolve)); if (i >= 120 && previous > 0) frameMs.push(now - previous); previous = now; }
    const sorted = [...frameMs].sort((a, b) => a - b);
    return { ticks: a.tick() - startTick, renderedFrames: a.perf().renderedFrames - startFrame, frameMs, frameMsP50: sorted[Math.ceil(sorted.length * .5) - 1], frameMsP95: sorted[Math.ceil(sorted.length * .95) - 1], perf: a.perf(), count: a.getState().ai!.count, adapter: adapter?.info ? { vendor: adapter.info.vendor, architecture: adapter.info.architecture, device: adapter.info.device, description: adapter.info.description } : null, userAgent: navigator.userAgent, recordedAt: new Date().toISOString() };
  });
  mkdirSync('test-results/epics/E18', { recursive: true }); writeFileSync('test-results/epics/E18/desktop-gpu.json', JSON.stringify(proof, null, 2));
  expect(proof.perf.backend).toBe('webgpu'); expect(proof.adapter).not.toBeNull(); expect(JSON.stringify(proof.adapter)).not.toMatch(/swiftshader|llvmpipe|software/i);
  expect(proof.perf.paused).toBe(false); expect(proof.ticks).toBeGreaterThanOrEqual(300); expect(proof.renderedFrames).toBeGreaterThanOrEqual(600); expect(proof.count).toBe(200); expect(proof.perf.quality.tier).toBe('high'); expect(proof.frameMsP95).toBeLessThanOrEqual(16.7);
});

test('E18 @E18 WebGPU low tier parity compiles two-mip bloom and capped crowds', async ({ page }) => {
  test.setTimeout(90_000); await page.goto('/?test=1&quality=low&audio=muted&dpr=3'); await page.waitForFunction(() => Boolean(window.__SS__)); await page.bringToFront();
  const proof = await page.evaluate(async () => {
    const a = window.__SS__!; await a.ready; await a.loadScenario('lookdev'); a.pause(); await a.screenshotReady();
    const bloom = a.perf(); await a.loadScenario('perf-horde-100'); a.pause(); await a.screenshotReady(); return { bloom, crowd: a.perf(), count: a.getState().ai!.count };
  });
  expect(proof.bloom.backend).toBe('webgpu'); expect(proof.crowd.quality.tier).toBe('low'); expect(proof.count).toBe(100);
  expect(proof.crowd.drawCalls).toBeLessThanOrEqual(300); expect(proof.crowd.triangles).toBeLessThanOrEqual(500_000);
  mkdirSync('test-results/epics/E18', { recursive: true }); writeFileSync('test-results/epics/E18/webgpu-low.json', JSON.stringify(proof, null, 2));
  await page.locator('canvas').screenshot({ path: 'test-results/epics/E18/webgpu-low.png' });
});
