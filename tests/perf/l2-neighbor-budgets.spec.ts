import { mkdirSync, writeFileSync } from 'node:fs';
import { devices } from '@playwright/test';
import { test } from '../e2e/fixtures';
const phase = process.env.L2_PERF_PHASE ?? 'after';
// Same native renderer, tier framing, throttle and real-clock sampling as T-E20-20.
test.use({ channel: 'chrome', headless: true, launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-frame-rate-limit', '--disable-gpu-vsync'] } });
for (const tier of ['high', 'low'] as const) test.describe(tier, () => {
  if (tier === 'low') test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: devices['Pixel 7'].deviceScaleFactor, userAgent: devices['Pixel 7'].userAgent, isMobile: true, hasTouch: true });
  for (const level of ['L1', 'L3'] as const) test(`neighbor performance ${level} ${tier}`, async ({ page, context }) => {
    test.setTimeout(300_000);
    if (tier === 'low') { const cdp = await context.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); }
    await page.goto(`/?test=1&renderer=webgl&quality=${tier}&audio=muted&dpr=${tier === 'high' ? 1 : 1.5}&profile`);
    await page.waitForFunction(() => Boolean(window.__SS__));
    await page.evaluate(async level => { const a = window.__SS__!; await a.ready; await a.loadLevel(level, { seed: 2 }); a.pause(); a.missions.begin(); a.cheats.god(true); await a.step(60); await a.screenshotReady(); }, level);
    const fixed = await page.evaluate(() => window.__SS__!.perf());
    const dir = 'test-results/epics/E20/perf/neighbors'; mkdirSync(dir, { recursive: true });
    await page.locator('canvas').screenshot({ path: `${dir}/${phase}-${level}-${tier}.png`, scale: 'css' });
    const timed = await page.evaluate(async () => {
      const a = window.__SS__!, frames: number[] = [], cpu: { sim: number; update: number; render: number }[] = []; let previous = 0; const start = performance.now(); a.resume();
      while (performance.now() - start < 10_000) {
        const now = await new Promise<number>(resolve => requestAnimationFrame(resolve));
        if (previous && frames.length > 2) { const p = a.perf(); cpu.push({ sim: p.simMs, update: p.updateCpuMs, render: p.renderCpuMs }); }
        if (previous) frames.push(now - previous); previous = now;
      }
      a.pause(); frames.splice(0, 3);
      const percentile = (values: number[], fraction: number) => values.sort((a, b) => a - b)[Math.ceil(values.length * fraction) - 1];
      return { peakP50: percentile(frames, .5), peakP95: percentile(frames, .95), peakMax: Math.max(...frames), frames: frames.length, simP95: percentile(cpu.map(c => c.sim), .95), updateP95: percentile(cpu.map(c => c.update), .95), renderP95: percentile(cpu.map(c => c.render), .95) };
    });
    const proof = { phase, level, tier, ...timed, drawCalls: fixed.drawCalls, triangles: fixed.triangles, profile: fixed.profile, profileAssets: fixed.profileAssets };
    writeFileSync(`${dir}/${phase}-${level}-${tier}.json`, JSON.stringify(proof, null, 2)); console.log(JSON.stringify(proof));
  });
});
