import { mkdirSync, writeFileSync } from 'node:fs';
import { devices } from '@playwright/test';
import { test, expect } from '../e2e/fixtures';

/** E20-AC20: the rescue peak within the E18 budgets (desktop high, phone low), and no hitch at the reveal or the gate close.
 * One worker, native GPU, under e2e-lock. Setup steps the paused sim (bots, ordinary inputs); measurements run the real clock. */
const dir = 'test-results/epics/E20/perf';
test.use({ channel: 'chrome', headless: true, launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-frame-rate-limit', '--disable-gpu-vsync'] } });
for (const tier of ['high', 'low'] as const) test.describe(tier, () => {
  if (tier === 'low') test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: devices['Pixel 7'].deviceScaleFactor, userAgent: devices['Pixel 7'].userAgent, isMobile: true, hasTouch: true });
  test(`T-E20-20 @E20 @E20-AC20 @perf L2 rescue peak, reveal and gate close ${tier}`, async ({ page, context }) => {
    test.setTimeout(600_000); mkdirSync(dir, { recursive: true });
    if (tier === 'low') { const cdp = await context.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); }
    await page.goto(`/?test=1&renderer=webgl&quality=${tier}&audio=muted&dpr=${tier === 'high' ? 1 : 1.5}&profile`);
    await page.waitForFunction(() => Boolean(window.__SS__));
    await page.evaluate(async () => { const a = window.__SS__!; await a.ready; await a.loadLevel('L2', { seed: 2, progression: 'L2-default' }); a.pause(); a.missions.begin(); a.cheats.god(true); a.bot.start('complete'); });
    const step = async (until: string, max = 400) => { for (let i = 0; i < max && !await page.evaluate(until); i++) await page.evaluate(() => window.__SS__!.step(30)); };
    /** rAF frame times while the real clock runs, until `until` holds (plus `tail` ms). */
    const record = (until: string, tail: number, minMs = 0) => page.evaluate(async ({ until, tail, minMs }) => {
      const a = window.__SS__!, frames: number[] = [], cpu: { sim: number; update: number; render: number }[] = []; let previous = 0, end = 0; const start = performance.now(); a.resume();
      for (let i = 0; i < 4000; i++) {
        const now = await new Promise<number>(resolve => requestAnimationFrame(resolve));
        if (previous && i > 2) { frames.push(now - previous); const p = a.perf(); cpu.push({ sim: p.simMs, update: p.updateCpuMs, render: p.renderCpuMs }); } previous = now;
        if (!end && (0, eval)(until) && now - start >= minMs) end = now + tail;
        if (end && now >= end) break;
      }
      a.pause(); (window as unknown as { l2Cpu: typeof cpu }).l2Cpu = cpu; return frames;
    }, { until, tail, minMs });
    const percentile = (values: number[], fraction: number) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * fraction) - 1];
    // The reveal: stand by while the crew forces the doors, then run the real clock through doors-open + 2 s.
    await step('window.__SS__.missions.state().l2.atDoorsAt > 0');
    const reveal = await record('window.__SS__.missions.state().l2.doorsOpenAt > 0', 2000);
    // The peak: idle at the doors (bot stopped) until >= 30 infected are up, then the game camera at l2-collapse.
    await page.evaluate(() => window.__SS__!.bot.stop());
    await step('window.__SS__.getState().ai.count >= 30', 200);
    const counts = await page.evaluate(() => { const a = window.__SS__!, all = a.query({}); return { infected: a.getState().ai!.count, civilians: all.filter(e => e.civilian && !e.civilian.ally && !e.hidden && e.health.current > 0 && !['infected', 'finished'].includes(e.civilian.state)).length, firefighters: all.filter(e => e.appearance?.asset === 'npc.firefighter-alive' && e.health.current > 0).length }; });
    await page.evaluate(async () => { const a = window.__SS__!; a.camera.preset('D-GROVE/W1/l2-collapse'); await a.screenshotReady(); });
    const fixed = await page.evaluate(() => window.__SS__!.perf());
    await page.locator('canvas').screenshot({ path: `${dir}/l2-collapse-${tier}.png`, scale: 'css' });
    await page.evaluate(() => window.__SS__!.camera.follow());
    const peak = await record('true', 10_000);
    const cpu = await page.evaluate(() => (window as unknown as { l2Cpu: { sim: number; update: number; render: number }[] }).l2Cpu);
    // The gate close: the bot runs on to the checkpoint; record from the approach through the close + 1.5 s.
    await page.evaluate(() => window.__SS__!.bot.start('complete'));
    await step('(() => { const p = window.__SS__.getState().player.transform; return p.x > 62 || window.__SS__.missions.state().l2.crossedAt > 0; })()', 800);
    const gate = await record('window.__SS__.missions.state().l2.gateClosedAt > 0', 1500);
    const proof = { tier, seed: 2, counts, drawCalls: fixed.drawCalls, triangles: fixed.triangles, revealMaxMs: Math.max(...reveal), gateMaxMs: Math.max(...gate), peakP50: percentile(peak, .5), peakP95: percentile(peak, .95), peakMax: Math.max(...peak), frames: peak.length, simP95: percentile(cpu.map(c => c.sim), .95), updateP95: percentile(cpu.map(c => c.update), .95), renderP95: percentile(cpu.map(c => c.render), .95), gateClosed: await page.evaluate(() => window.__SS__!.missions.state()!.l2!.gateClosedAt > 0) };
    writeFileSync(`${dir}/l2-${tier}.json`, JSON.stringify({ ...proof, profile: fixed.profile, profileAssets: fixed.profileAssets, reveal, gate }, null, 2));
    console.log(JSON.stringify(proof));
    expect(counts.infected).toBeGreaterThanOrEqual(tier === 'high' ? 30 : 15); expect(counts.firefighters).toBe(6);
    expect(counts.civilians + counts.firefighters).toBeGreaterThanOrEqual(tier === 'high' ? 30 : 10);
    expect(proof.gateClosed).toBe(true);
    expect(proof.drawCalls).toBeLessThanOrEqual(tier === 'high' ? 600 : 300); expect(proof.triangles).toBeLessThanOrEqual(tier === 'high' ? 1_500_000 : 500_000);
    expect(proof.peakP95).toBeLessThanOrEqual(tier === 'high' ? 14 : 1000 / 30);
    expect(proof.revealMaxMs).toBeLessThanOrEqual(50); expect(proof.gateMaxMs).toBeLessThanOrEqual(50);
  });
});
