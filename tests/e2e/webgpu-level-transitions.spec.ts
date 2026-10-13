import { boot, expect, test, testUrl } from './fixtures';

// Regression (lane webgpu-texture, 10-13): the Scene Lab matrix logged "Texture copy range 65×N touches outside 65×1"
// on WebGPU. LightField's per-level light-visibility DataTexture changed height per level (one row per static light),
// but three's WebGPU backend keeps the GPU texture from the first upload, so a later level with more lights wrote past
// it. WebGL reallocates on texImage2D, so only WebGPU failed. This drives the title screen and three campaign levels in
// one renderer with the light field active (a transient pool keeps it drawing in daylight) and fails on any GPU
// validation message, including Chromium's WebGPU warnings, which the shared error guard (errors only) does not catch.
test.use({ launchOptions: { args: process.platform === 'darwin'
  ? ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-unsafe-webgpu']
  : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu'] } });

const gpuMessage = /Texture|GPUValidationError|WebGPU|touches outside|Invalid (Texture|BindGroup|CommandBuffer)/i;

test('T-E02-webgpu-level-transitions @smoke @E02 title, L1, L2 and L3 in one WebGPU renderer log no GPU validation errors', async ({ page }) => {
  test.setTimeout(300_000);
  await page.goto('/');
  const adapter = await page.evaluate(async () => Boolean(await (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu?.requestAdapter()));
  test.skip(!adapter && process.platform !== 'darwin', 'No WebGPU adapter in this headless browser');
  const messages: string[] = [];
  page.on('console', message => { if (['error', 'warning'].includes(message.type()) && gpuMessage.test(message.text())) messages.push(`${message.type()}: ${message.text()}`); });
  await boot(page, `${testUrl.replace('renderer=webgl', 'renderer=webgpu')}&ui=1`);
  expect(await page.evaluate(() => window.__SS__!.perf().backend)).toBe('webgpu');
  await page.evaluate(() => window.__SS__!.screenshotReady());
  const visited: { level: string; statics: number; drawn: number }[] = [];
  for (const [level, progression] of [['L1', undefined], ['L2', 'L2-default'], ['L3', 'L3-default'], ['L1', undefined]] as const) {
    const state = await page.evaluate(async ({ level, progression }) => {
      const a = window.__SS__!;
      await a.loadLevel(level, { seed: 1, ...(progression ? { progression } : {}) }); a.pause();
      const p = a.getState().player!.transform;
      // An infinite transient keeps the field pass (which samples the visibility texture) drawing at any time of day.
      a.lights.addTransient({ x: p.x, z: p.z }, '#ffb060', 6, 6, Infinity);
      await a.step(30); await a.screenshotReady(); await a.step(5); await a.screenshotReady();
      return a.lights.state()!;
    }, { level, progression });
    visited.push({ level, statics: state.statics, drawn: state.drawn });
    expect(state.drawn, `${level} light field draws`).toBeGreaterThan(0);
  }
  // Let queued uncaptured-error reports reach the console.
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 500)));
  expect(new Set(visited.map(v => v.statics)).size, `levels differ in static light count: ${JSON.stringify(visited)}`).toBeGreaterThan(1);
  expect(messages, 'GPU validation messages').toEqual([]);
});
