import { mkdirSync, writeFileSync } from 'node:fs';
import { devices } from '@playwright/test';
import { weatherTimelines } from '../../src/data/weather';
import { test, expect, boot } from '../e2e/fixtures';

test.use({ channel: 'chrome', headless: true, launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-frame-rate-limit', '--disable-gpu-vsync'] } });
for (const tier of ['high', 'low'] as const) test.describe(tier, () => {
  if (tier === 'low') test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: devices['Pixel 7'].deviceScaleFactor, userAgent: devices['Pixel 7'].userAgent, isMobile: true, hasTouch: true });
  for (const level of ['L1', 'L3', 'L5'] as const) test(`live weather ${level} ${tier} @weather-live @perf blend has no hitch`, async ({ page, context }) => {
    test.setTimeout(480_000);
    if (tier === 'low') await (await context.newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await boot(page, `/?test=1&renderer=webgl&quality=${tier}&dpr=${tier === 'high' ? 1 : 1.5}&audio=muted&profile`);
    const key = weatherTimelines[level][1];
    await page.evaluate(async ({ level, tick, control }) => {
      const a = window.__SS__!;
      await a.loadLevel(level, { seed: 28, ...(level === 'L1' ? {} : { progression: `${level}-default` as 'L3-default' | 'L5-default' }) });
      a.pause(); a.missions.begin(); a.cheats.god(true);
      if (control) a.weather.override(control);
      await a.step(tick - 5 * 60); await a.screenshotReady();
    }, { level, tick: key.tick, control: process.env.WEATHER_CONTROL ? weatherTimelines[level][0].kind : null });
    const profiler = process.env.WEATHER_CPU_PROFILE ? await context.newCDPSession(page) : null;
    if (profiler) { await profiler.send('Profiler.enable'); await profiler.send('Profiler.start'); }
    const result = await page.evaluate(async duration => {
      const a = window.__SS__!, start = a.tick() + 5 * 60, frames: number[] = [], baseline: number[] = [], hitches: { tick: number; ms: number }[] = [];
      const tasks: { start: number; duration: number }[] = [];
      const observer = new PerformanceObserver(list => tasks.push(...list.getEntries().map(e => ({ start: e.startTime, duration: e.duration }))));
      observer.observe({ type: 'longtask', buffered: false });
      const before = a.getState().weather, countersBefore = a.perf();
      // Warm the unchanged graph before timing; this also covers the zero-density particle pipeline.
      for (let i = 0; i < 120; i++) await new Promise(requestAnimationFrame);
      let previous = 0;
      const prototype = WebGL2RenderingContext.prototype, link = prototype.linkProgram;
      let links = 0;
      prototype.linkProgram = function(program) { links++; return link.call(this, program); };
      a.resume();
      while (a.tick() < start) { const now = await new Promise<number>(requestAnimationFrame); if (previous) baseline.push(now - previous); previous = now; }
      const baselineLinks = links; links = 0; previous = 0;
      while (a.tick() < start + duration * 60) {
        const now = await new Promise<number>(requestAnimationFrame);
        if (previous) { frames.push(now - previous); if (now - previous > 40) hitches.push({ tick: a.tick(), ms: now - previous }); } previous = now;
      }
      a.pause(); observer.disconnect(); prototype.linkProgram = link; const after = a.getState().weather, countersAfter = a.perf();
      const q = (v: number[], p: number) => [...v].sort((a, b) => a - b)[Math.ceil(v.length * p) - 1];
      return { hitches, tasks, baselineLinks, blendLinks: links, before, after, countersBefore, countersAfter, baselineP95: q(baseline, .95), p50: q(frames, .5), p95: q(frames, .95), max: Math.max(...frames), frames: frames.length };
    }, key.blend!);
    const dir = process.env.WEATHER_CONTROL ? 'test-results/weather-live/control' : 'test-results/weather-live/perf'; mkdirSync(dir, { recursive: true });
    if (profiler) writeFileSync(`${dir}/${level}-${tier}.cpuprofile`, JSON.stringify((await profiler.send('Profiler.stop')).profile));
    writeFileSync(`${dir}/${level}-${tier}.json`, JSON.stringify(result, null, 2)); console.log(JSON.stringify({ level, tier, baselineP95: result.baselineP95, p50: result.p50, p95: result.p95, max: result.max, blendLinks: result.blendLinks, draws: result.countersAfter.drawCalls, triangles: result.countersAfter.triangles }));
    expect(result.blendLinks).toBe(0);
    expect(result.after!.blend).toBe(1);
    expect(result.after!.kind).toBe(process.env.WEATHER_CONTROL ? weatherTimelines[level][0].kind : key.kind);
    expect(result.max).toBeLessThanOrEqual(tier === 'high' ? 50 : 80);
    if (tier === 'high') expect(result.p95).toBeLessThanOrEqual(14); else expect(result.p50).toBeLessThanOrEqual(1000 / 30);
    for (const p of [result.countersBefore, result.countersAfter]) {
      expect(p.drawCalls).toBeLessThanOrEqual(tier === 'high' ? 600 : 300);
      expect(p.triangles).toBeLessThanOrEqual(tier === 'high' ? 1_500_000 : 500_000);
    }
  });
});
