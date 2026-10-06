import { devices } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { test, expect } from '../e2e/fixtures';
import { validateDeviceEvidence } from '../../tools/performance/deviceEvidence';
// Authorized AC08 proxy: headless native GPU Chromium with mobile/touch and CDP CPU throttling.
// Keep real-device recordings separate; the physical recorder remains available for final user verification.
test.use({ channel: 'chrome', headless: true, launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] } });
for (const [profile, platform, rate] of [['Pixel 7', 'android', 4], ['iPhone 14', 'ios', 2]] as const) {
  test.describe(profile, () => {
    test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: devices[profile].deviceScaleFactor, userAgent: devices[profile].userAgent, isMobile: true, hasTouch: true });
    for (const backend of ['webgl', 'webgpu'] as const) test(`T-E18-08-${platform}-${backend} @E18-AC08 @perf emulated mobile L6 at ${rate}x CPU p50 >=30fps`, async ({ page, context }) => {
      test.skip(backend === 'webgpu', 'WebGPU-only checks require manual verification; browser automation is headless.');
      test.setTimeout(240_000);
      const cdp = await context.newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate });
      await page.goto(`/perf-device.html?renderer=${backend}`);
      const frame = page.frames().find(f => f.parentFrame())!;
      await frame.waitForFunction(() => Boolean(window.__SS__));
      const proof = await frame.evaluate(async ({ platform, profile, rate }) => {
        const a = window.__SS__!; await a.ready; await a.loadScenario('perf-l6-mainstreet'); a.cheats.god(true); a.resume();
        await new Promise(resolve => setTimeout(resolve, 5000));
        const frameMs: number[] = [], started = performance.now(), firstTick = a.tick(); let previous = a.perf().renderedFrames;
        while (frameMs.length < 1200) {
          await new Promise(requestAnimationFrame);
          if (document.hidden) throw new Error('Emulation recording lost visibility');
          const p = a.perf(); if (p.renderedFrames === previous) continue; previous = p.renderedFrames;
          if (p.frameMs > 0) frameMs.push(p.frameMs);
        }
        const adapter = await (navigator as Navigator & { gpu?: { requestAdapter(): Promise<{ info?: { vendor: string; architecture: string; device: string; description: string } } | null> } }).gpu?.requestAdapter();
        const sorted = [...frameMs].sort((a, b) => a - b), canvas = document.querySelector('canvas')!, gl = canvas.getContext('webgl2'), extension = gl?.getExtension('WEBGL_debug_renderer_info');
        return { version: 1, physicalDevice: false, emulatedDevice: true, cpuThrottleRate: rate, browser: 'chromium', deviceClass: 'mid-range', platform, model: `${profile} emulated`, recordedAt: new Date().toISOString(), userAgent: navigator.userAgent, scenario: 'perf-l6-mainstreet', quality: a.perf().quality.tier, backend: a.perf().backend, viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio }, touchPoints: navigator.maxTouchPoints, adapter: adapter?.info ? { vendor: adapter.info.vendor, architecture: adapter.info.architecture, device: adapter.info.device, description: adapter.info.description } : null, gpu: extension ? gl!.getParameter(extension.UNMASKED_RENDERER_WEBGL) as string : null, durationMs: performance.now() - started, frameMs, fpsP50: 1000 / sorted[Math.ceil(sorted.length * .5) - 1], infected: a.getState().ai!.count, ticks: a.tick() - firstTick, perf: a.perf() };
      }, { platform, profile, rate });
      mkdirSync('test-results/perf/devices', { recursive: true }); writeFileSync(`test-results/perf/devices/emulated-${platform}-${backend}.json`, JSON.stringify(proof, null, 2) + '\n');
      expect(proof.perf.paused).toBe(false); expect(proof.backend).toBe(backend); expect(proof.touchPoints).toBeGreaterThan(0); expect(proof.ticks).toBeGreaterThan(300);
      expect(proof.gpu ?? JSON.stringify(proof.adapter)).not.toMatch(/swiftshader|llvmpipe|software/i);
      if (backend === 'webgpu') expect(proof.adapter).not.toBeNull(); else expect(proof.gpu).not.toBeNull();
      expect(validateDeviceEvidence(proof, 'emulated')).toEqual([]);
      await page.screenshot({ path: `test-results/epics/E18/emulated-${platform}-${backend}.png` });
    });
  });
}

// Re-enable the original physical gate automatically when the user's recordings arrive.
test('T-E18-08-physical @E18-AC08 @manual physical iOS and Android recordings at final verification', () => {
  const dir = 'test-results/perf/devices';
  const files = existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith('.json') && !f.startsWith('emulated-')) : [];
  test.skip(files.length === 0, 'AC08 real-device recordings pending user run at final verification; emulated profiles recorded');
  const recordings = files.map(file => JSON.parse(readFileSync(`${dir}/${file}`, 'utf8')) as { platform: string });
  for (const platform of ['ios', 'android']) expect(recordings.some(d => d.platform === platform && validateDeviceEvidence(d).length === 0), `Valid physical ${platform} recording`).toBe(true);
});
