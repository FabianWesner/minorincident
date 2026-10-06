import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect } from './fixtures';
import { menuStart } from './ui-helpers';

// Native GPU, headless, unthrottled. Fixed close-camera poses are identical before/after.
test.use({ headless: true, launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-frame-rate-limit', '--disable-gpu-vsync'] } });
const spots = [
  { name: '01-porch', x: -14, z: -7 },
  { name: '02-crescent', x: 0, z: 0 },
  { name: '03-connection', x: 27, z: 0 },
  { name: '04-diner', x: 42, z: -6.5 },
  { name: '05-main', x: 56, z: 0 },
  { name: '06-hardware', x: 70, z: -7 },
  { name: '07-shop', x: 70, z: 47 },
];
for (const mobile of [false, true]) test.describe(mobile ? 'iPhone portrait' : 'desktop', () => {
  test.use({ viewport: mobile ? { width: 390, height: 844 } : { width: 1600, height: 900 }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  test('@E19 @M1-14 L1 close-camera surfaces, dressing, ambient motion and GPU budget', async ({ page }) => {
    test.setTimeout(240_000);
    const stage = process.env.M1_LOOK_CAPTURE ?? 'after';
    const output = `test-results/m1-look/${stage}/${mobile ? 'iphone' : 'desktop'}`;
    mkdirSync(output, { recursive: true });
    await menuStart(page);
    await page.evaluate(() => { const a = window.__SS__!; a.pause(); a.cheats.god(true); a.settings.set({ quality: 'high' }); });
    if (mobile) await page.evaluate(() => window.__SS__!.settings.set({ quality: 'low' }));
    const cdp = await page.context().newCDPSession(page);
    const measurements = [];
    for (const spot of spots) {
      await page.evaluate(async ({ x, z }) => {
        const a = window.__SS__!; a.pause(); a.input.clear(); a.teleport('player', { x, z }); a.camera.follow(); await a.step(90); await a.screenshotReady();
      }, spot);
      await page.screenshot({ path: `${output}/${spot.name}.png` });
      const data = await page.evaluate(async () => {
        const a = window.__SS__!; a.resume();
        const intervals: number[] = []; let previous = 0;
        for (let i = 0; i < 180; i++) {
          const now = await new Promise<number>(resolve => requestAnimationFrame(resolve));
          if (i > 30) intervals.push(now - previous); previous = now;
        }
        a.pause(); intervals.sort((a, b) => a - b);
        const gl = document.querySelector('canvas')!.getContext('webgl2')!, ext = gl.getExtension('WEBGL_debug_renderer_info');
        return { medianFps: 1000 / intervals[Math.floor(intervals.length * .5)], p95Ms: intervals[Math.floor(intervals.length * .95)], unthrottled: true, gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string : null, perf: a.perf(), world: a.getState().render.districts };
      });
      // The page's performance.memory is quantized. Match E18's collected CDP heap measurement.
      await cdp.send('HeapProfiler.collectGarbage');
      const heap = await cdp.send('Runtime.getHeapUsage');
      measurements.push({ spot, ...data, collectedHeapBytes: heap.usedSize });
      writeFileSync(`${output}/metrics.json`, JSON.stringify(measurements, null, 2));
    }
    for (const data of measurements) {
      expect(data.gpu).not.toMatch(/swiftshader|llvmpipe|software/i);
      expect(data.medianFps, data.spot.name).toBeGreaterThanOrEqual(mobile ? 30 : 60);
      expect(data.perf.drawCalls).toBeLessThanOrEqual(mobile ? 300 : 600);
      expect(data.perf.triangles).toBeLessThanOrEqual(mobile ? 500_000 : 1_500_000);
      expect(data.collectedHeapBytes).toBeLessThanOrEqual(mobile ? 250_000_000 : 400_000_000);
    }
    // Real input remains connected with the richer ground/scene.
    await page.evaluate(async () => { const a = window.__SS__!; a.teleport('player', { x: 0, z: 0 }); await a.step(90); });
    const start = await page.evaluate(() => window.__SS__!.getState().player!.transform);
    if (mobile) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, x: 70, y: 506 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 1, x: 110, y: 546 }] });
      await page.evaluate(() => window.__SS__!.step(30));
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else {
      const point = await page.evaluate(() => window.__SS__!.input.project({ x: 2, z: 0 }));
      await page.mouse.click(point.x, point.y); await page.evaluate(() => window.__SS__!.step(30));
    }
    const end = await page.evaluate(() => window.__SS__!.getState().player!.transform);
    expect(Math.hypot(end.x - start.x, end.z - start.z)).toBeGreaterThan(1);
    expect(end.y).toBeGreaterThan(.65);
    await page.evaluate(() => window.__SS__!.screenshotReady());
    await page.screenshot({ path: `${output}/08-real-input.png` });
    await cdp.detach();
  });
});
