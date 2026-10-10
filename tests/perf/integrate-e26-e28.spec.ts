import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { loadavg } from 'node:os';
import { devices } from '@playwright/test';
import { test, expect, boot } from '../e2e/fixtures';

/** Paired native Mac campaign sample: identical seed, setup, camera and sample count on main and integration. */
test.use({ channel: 'chrome', headless: true, launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-frame-rate-limit', '--disable-gpu-vsync'] } });
for (const tier of ['high', 'low'] as const) test.describe(tier, () => {
  if (tier === 'low') test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: devices['Pixel 7'].deviceScaleFactor, userAgent: devices['Pixel 7'].userAgent, isMobile: true, hasTouch: true });
  for (const level of ['L1', 'L2', 'L3', 'L4'] as const) test(`integration ${level} ${tier} @perf`, async ({ page, context }) => {
    test.setTimeout(300_000);
    const loadBefore = loadavg();
    if (tier === 'low') { const cdp = await context.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); }
    await boot(page, `/?test=1&renderer=webgl&quality=${tier}&dpr=${tier === 'high' ? 1 : 1.5}&audio=muted&profile`);
    await page.evaluate(async level => {
      const a = window.__SS__!;
      await a.loadLevel(level, { seed: 28, ...(level === 'L1' ? {} : { progression: `${level}-default` as 'L2-default' | 'L3-default' | 'L4-default' }) });
      a.pause(); a.missions.begin(); a.cheats.god(true); await a.step(120);
    }, level);
    const result = await page.evaluate(async () => {
      const a = window.__SS__!, frames: number[] = [], cpu: number[] = []; let previous = 0; a.resume();
      for (let i = 0; i < 720; i++) {
        const now = await new Promise<number>(resolve => requestAnimationFrame(resolve));
        if (previous && i >= 120) { frames.push(now - previous); const p = a.perf(); cpu.push(p.updateCpuMs + p.renderCpuMs); }
        previous = now;
      }
      a.pause(); const q = (v: number[], p: number) => [...v].sort((a, b) => a - b)[Math.ceil(v.length * p) - 1];
      return { frameP50: q(frames, .5), frameP95: q(frames, .95), cpuP95: q(cpu, .95), counters: a.perf(), frames };
    });
    const dir = 'test-results/integrate-e26-e28/perf'; mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/${process.env.INTEGRATION_PHASE ?? 'after'}-${level}-${tier}.json`, JSON.stringify({ level, tier, seed: 28, ...result, loadBefore, measuredAt: new Date().toISOString() }, null, 2));
    console.log(JSON.stringify({ level, tier, frameP50: result.frameP50, frameP95: result.frameP95, cpuP95: result.cpuP95 }));
    expect(result.counters.drawCalls).toBeLessThanOrEqual(tier === 'high' ? 600 : 300);
    expect(result.counters.triangles).toBeLessThanOrEqual(tier === 'high' ? 1_500_000 : 500_000);
    // Record both absolute budgets and paired regression results even if main already exceeds a budget.
    if (tier === 'high') expect.soft(result.frameP95).toBeLessThanOrEqual(level === 'L1' ? 16.7 : 14);
    else expect(result.frameP50).toBeLessThanOrEqual(1000 / 30);
    if (process.env.INTEGRATION_PHASE === 'after') {
      const before = JSON.parse(readFileSync(`${dir}/before-${level}-${tier}.json`, 'utf8')) as { frameP95: number };
      expect(result.frameP95, `${level} ${tier} p95 regression must not exceed 5%`).toBeLessThanOrEqual(before.frameP95 * 1.05);
    }
  });
});
