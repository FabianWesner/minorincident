import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect, boot } from '../e2e/fixtures';
// One worker when invoked: native GPU timing, headless, under tools/e2e-lock.sh.
// Rendering is unthrottled to measure headroom beyond the display refresh ceiling.
test.use({ launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-frame-rate-limit', '--disable-gpu-vsync'] } });
for (const mobile of [false, true]) test.describe(mobile ? 'portrait low' : 'desktop high', () => {
  test.use({ viewport: mobile ? { width: 390, height: 844 } : { width: 1600, height: 900 }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  test('@lookperf look tools retain the 200-infected combat frame and geometry budgets', async ({ page }) => {
    await boot(page, `/?test=1&renderer=webgl&audio=muted&dpr=1&quality=${mobile ? 'low' : 'high'}`);
    const proof = await page.evaluate(async () => {
      const a = window.__SS__!; await a.loadScenario('perf-horde-200'); a.pause(); a.camera.preset('perf-horde'); await a.screenshotReady(); a.resume();
      const frames: number[] = []; let previous = 0;
      const firstTick = a.tick(), started = performance.now();
      for (let i = 0; i < 360 || performance.now() - started < 3000; i++) {
        const now = await new Promise<number>(resolve => requestAnimationFrame(resolve));
        if (i > 120) frames.push(now - previous); previous = now;
      }
      frames.sort((a, b) => a - b);
      const gl = document.querySelector('canvas')!.getContext('webgl2')!, ext = gl.getExtension('WEBGL_debug_renderer_info');
      a.pause();
      return { gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string : null, p95Ms: frames[Math.ceil(frames.length * .95) - 1], infected: a.getState().ai!.count, ticks: a.tick() - firstTick, perf: a.perf() };
    });
    mkdirSync('test-results/look-round', { recursive: true });
    writeFileSync(`test-results/look-round/perf-${mobile ? 'portrait' : 'desktop'}.json`, JSON.stringify(proof, null, 2) + '\n');
    expect(proof.gpu).not.toBeNull(); expect(proof.gpu).not.toMatch(/swiftshader|llvmpipe|software/i);
    expect(proof.infected).toBe(200); expect(proof.ticks).toBeGreaterThan(100);
    expect(proof.p95Ms).toBeLessThanOrEqual(mobile ? 1000 / 30 : 1000 / 60);
    expect(proof.perf.drawCalls).toBeLessThanOrEqual(mobile ? 300 : 600);
    expect(proof.perf.triangles).toBeLessThanOrEqual(mobile ? 500_000 : 1_500_000);
  });
});
