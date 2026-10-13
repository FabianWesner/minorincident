import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect, boot, testUrl } from '../fixtures';

/** PO 2026-10-12: "L4: Bus is extremely vibrating when driving." The drawn bus must move like the interpolated camera: on screen it
 * stays put (the camera follows it) and the road scrolls smoothly, also on an uneven 120 Hz display. */
// 30 Hz and an uneven phone cadence (PO 10-13, low tier): more than one sim tick per drawn frame.
const pacings = { '60hz': [1000 / 60], '120hz': [1000 / 120], 'uneven-120hz': [6.1, 10.9, 7.4, 9.8, 5.6, 11.2, 8.3, 7.2], '30hz': [1000 / 30], 'uneven-phone': [16.7, 33.3, 25, 41.7, 16.7, 50, 20.8, 29.2] } as const;
const rms = (t: number[], y: number[], window = 100): number => {
  // High-pass: residual from a local linear fit over 100 ms windows (the ride is smooth at that scale; 250 ms at phone cadences).
  let sum = 0, count = 0;
  for (let start = 0; start < t.length;) {
    let end = start; while (end < t.length && t[end] - t[start] < window) end++;
    const n = end - start;
    if (n >= 5) {
      let st = 0, sy = 0, stt = 0, sty = 0; for (let i = start; i < end; i++) { st += t[i]; sy += y[i]; stt += t[i] * t[i]; sty += t[i] * y[i]; }
      const slope = (n * sty - st * sy) / (n * stt - st * st), offset = (sy - slope * st) / n;
      for (let i = start; i < end; i++) { const e = y[i] - (offset + slope * t[i]); sum += e * e; count++; }
    }
    start = end;
  }
  return Math.sqrt(sum / count);
};

/** PO 2026-10-13 (the same report again, on low/webgpu, after the fix was measured only on high/WebGL): every quality tier and backend. */
test.use({ launchOptions: { args: process.platform === 'darwin'
  ? ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-unsafe-webgpu']
  : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu'] } });
const configs = (['webgl', 'webgpu'] as const).flatMap(renderer => (['high', 'low'] as const).map(quality => ({ renderer, quality })));
for (const { renderer, quality } of configs) for (const [pace, steps] of Object.entries(pacings)) {
  // The uniform 120 Hz case only for the reference config; 60 Hz and the uneven 120 Hz display everywhere.
  if (pace === '120hz' && (renderer !== 'webgl' || quality !== 'high')) continue;
  const name = renderer === 'webgl' && quality === 'high' ? pace : `${pace}-${renderer}-${quality}`;
  test(`T-E22-ride-smooth-${name} @E22 the L4 convoy bus does not vibrate on screen during the ride (${name})`, async ({ page }) => {
    test.setTimeout(300_000); mkdirSync('test-results/epics/E22', { recursive: true });
    if (renderer === 'webgpu') {
      await page.goto('/');
      const adapter = await page.evaluate(async () => Boolean(await (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu?.requestAdapter()));
      test.skip(!adapter && process.platform !== 'darwin', 'No WebGPU adapter in this headless browser');
    }
    await page.addInitScript((pattern: number[]) => {
      const real = window.requestAnimationFrame.bind(window);
      let lastReal = -1, virtual = 0, frame = 0;
      window.requestAnimationFrame = (callback: FrameRequestCallback) => real((now) => {
        if (now !== lastReal) { lastReal = now; virtual += pattern[frame++ % pattern.length]; }
        callback(virtual);
      });
    }, [...steps]);
    await boot(page, `${testUrl.replace('renderer=webgl', `renderer=${renderer}`).replace('quality=high', `quality=${quality}`)}&ui=1`);
    await page.evaluate(() => window.__SS__!.loadLevel('L4', { seed: 1, progression: 'L4-default' }));
    await page.evaluate(() => window.__SS__!.pause());
    await page.getByRole('button', { name: 'Begin mission' }).click();
    await page.evaluate(() => window.__SS__!.resume());
    // Past the shader/pipeline warm-up stalls, still inside the 20-35 s ride. The virtual clock advances one pattern step per
    // real frame, so a slower cadence runs the game faster than real time: wait the same game time (about 8 s at 60 Hz).
    const mean = steps.reduce((a, b) => a + b, 0) / steps.length;
    await page.waitForTimeout(Math.round(8000 * (1000 / 60) / mean));
    const samples = await page.evaluate(() => new Promise<{ t: number; bus: number[]; apc: number[]; prop: number[] }[]>((resolve) => {
      const api = window.__SS__!, out: { t: number; bus: number[]; apc: number[]; prop: number[] }[] = [], ids = api.missions.state()!.l4!.convoyIds;
      let start = -1, fixed: number[] | null = null;
      const record = (now: number) => {
        if (start < 0) start = now;
        const elapsed = now - start, actors = api.getState().render.entityAssets!.actors as { id: number; position: number[] }[];
        const at = (id: number) => { const a = actors.find(x => x.id === id)!.position, p = api.camera.project(a[0], a[1] + 1.5, a[2]); return [p[0] * innerWidth / 2, p[1] * innerHeight / 2]; };
        const bus = actors.find(x => x.id === ids[ids.length - 1])!.position;
        fixed ??= [bus[0] + 4, 0, bus[2] + 4];
        const f = api.camera.project(fixed[0], fixed[1], fixed[2]);
        out.push({ t: elapsed, bus: at(ids[ids.length - 1]), apc: at(ids[0]), prop: [f[0] * innerWidth / 2, f[1] * innerHeight / 2] });
        if (elapsed < 1500) requestAnimationFrame(record); else resolve(out);
      };
      requestAnimationFrame(record);
    }));
    if (name === '60hz') await page.screenshot({ path: 'test-results/epics/E22/ride-bus.png' });
    const t = samples.map(s => s.t), fit = steps.reduce((a, b) => a + b, 0) / steps.length > 20 ? 250 : 100, jit = (pick: (s: typeof samples[number]) => number[]) => Math.hypot(rms(t, samples.map(s => pick(s)[0]), fit), rms(t, samples.map(s => pick(s)[1]), fit));
    // The lead vehicle only counts while it is on screen (behind the lens its projection is meaningless).
    const half = page.viewportSize() ?? { width: 1600, height: 900 }, onScreen = samples.every(s => Math.abs(s.apc[0]) < half.width / 2 && Math.abs(s.apc[1]) < half.height / 2);
    const result = { frames: samples.length, busJitterPx: jit(s => s.bus), apcJitterPx: onScreen ? jit(s => s.apc) : null, roadJitterPx: jit(s => s.prop) };
    writeFileSync(`test-results/epics/E22/ride-smooth-${name}.json`, JSON.stringify({ ...result, samples: samples.map(s => ({ t: +s.t.toFixed(1), bus: s.bus.map(v => +v.toFixed(2)), apc: s.apc.map(v => +v.toFixed(2)) })) }));
    expect(samples.length).toBeGreaterThan(30);
    // The bus is the camera's subject: it stays put on screen (the earlier tick-snapped bus swung 10+ px against the interpolated camera).
    expect(result.busJitterPx, 'bus screen jitter (px RMS)').toBeLessThanOrEqual(0.6);
    if (result.apcJitterPx !== null) expect(result.apcJitterPx, 'lead vehicle screen jitter (px RMS)').toBeLessThanOrEqual(0.6);
  });
}
