import { mkdirSync, writeFileSync } from 'node:fs';
import { devices } from '@playwright/test';
import { test, expect } from '../e2e/fixtures';

/** E22-AC20: the L4 war (soldiers firing, the HMG nests, the tank, the helicopter, 40+ civilians, the infected waves) and the collapse
 * within the E18 budgets (desktop high, phone low), and no frame > 50 ms at the first turn, a tank shot, the fuel-truck chain or the line
 * break. One worker, native GPU, under e2e-lock. Setup steps the paused sim (the L4 bot, ordinary inputs); measurements run the real clock. */
const dir = 'test-results/epics/E22/perf';
test.use({ channel: 'chrome', headless: true, launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-frame-rate-limit', '--disable-gpu-vsync'] } });
for (const tier of ['high', 'low'] as const) test.describe(tier, () => {
  if (tier === 'low') test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: devices['Pixel 7'].deviceScaleFactor, userAgent: devices['Pixel 7'].userAgent, isMobile: true, hasTouch: true });
  test(`T-E22-20 @E22 @E22-AC20 @perf L4 turn, war peak, tank shot, fuel-truck chain and line break ${tier}`, async ({ page, context }) => {
    test.setTimeout(1_200_000); mkdirSync(dir, { recursive: true });
    if (tier === 'low') { const cdp = await context.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); }
    await page.goto(`/?test=1&renderer=webgl&quality=${tier}&audio=muted&dpr=${tier === 'high' ? 1 : 1.5}&profile`);
    await page.waitForFunction(() => Boolean(window.__SS__));
    await page.evaluate(async () => { const a = window.__SS__!; await a.ready; await a.loadLevel('L4', { seed: 2, progression: 'L4-default' }); a.pause(); a.missions.begin(); a.cheats.god(true); a.bot.start('complete'); });
    const step = async (until: string, max = 600) => { for (let i = 0; i < max && !await page.evaluate(until); i++) await page.evaluate(() => window.__SS__!.step(15)); };
    /** rAF frame times while the real clock runs, until `until` holds (plus `tail` ms). */
    const record = (until: string, tail: number) => page.evaluate(async ({ until, tail }) => {
      const a = window.__SS__!, frames: number[] = [], cpu: { sim: number; update: number; render: number }[] = []; let previous = 0, end = 0; a.resume();
      for (let i = 0; i < 6000; i++) {
        const now = await new Promise<number>(resolve => requestAnimationFrame(resolve));
        if (previous && i > 2) { frames.push(now - previous); const p = a.perf(); cpu.push({ sim: p.simMs, update: p.updateCpuMs, render: p.renderCpuMs }); } previous = now;
        if (!end && (0, eval)(until)) end = now + tail;
        if (end && now >= end) break;
      }
      a.pause(); (window as unknown as { l4Cpu: typeof cpu }).l4Cpu = cpu; return frames;
    }, { until, tail });
    const percentile = (values: number[], fraction: number) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * fraction) - 1];
    const l4 = 'window.__SS__.missions.state().l4';
    // The ride and the calm plaza (the bot goes to the quartermaster), then the first turn.
    await step(`${l4}.phase === 'plaza'`, 800); await step(`${l4}.turnDueAt > 0 && ${l4}.turnDueAt - window.__SS__.getState().tick < 120`, 900);
    const turn = await record(`${l4}.turnAt > 0`, 2_000);
    // The war: from the tank's entry; the peak: HMG and rifles firing, the tank in place, the helicopter orbiting, the waves arriving.
    await step(`${l4}.tankPhase === 'hold' && ${l4}.heliPhase === 'orbit'`, 900);
    const counts = await page.evaluate(() => { const a = window.__SS__!, all = a.query({}); return { infected: a.getState().ai!.count, soldiers: all.filter(e => e.civilian?.ally?.role === 'soldier' && e.health.current > 0 && e.kind !== 'infected').length, civilians: all.filter(e => e.civilian && !e.civilian.ally && e.health.current > 0 && !e.hidden && e.kind !== 'infected').length }; });
    await page.evaluate(async () => { const a = window.__SS__!; a.camera.preset('D-FAIR/W0/l4-war-line'); await a.screenshotReady(); });
    const warStatic = await page.evaluate(() => window.__SS__!.perf());
    await page.locator('canvas').screenshot({ path: `${dir}/l4-war-line-${tier}.png`, scale: 'css' });
    await page.evaluate(() => window.__SS__!.camera.follow());
    const war = await record('true', 8_000);
    const warCpu = await page.evaluate(() => (window as unknown as { l4Cpu: { sim: number; update: number; render: number }[] }).l4Cpu);
    // A tank shot, then the line break (the fuel-truck mega chain, the helicopter pulling out).
    const shots = await page.evaluate(`${l4}.tankShots`) as number;
    const tank = await record(`${l4}.tankShots > ${shots}`, 2_000);
    await step(`${l4}.lineBreakAt > 0 || ${l4}.phase === 'collapse'`, 900);
    const breakFrames = await record(`${l4}.lineBreakAt > 0`, 5_000);
    await page.evaluate(async () => { const a = window.__SS__!; a.camera.preset('D-FAIR/W0/l4-collapse'); await a.screenshotReady(); });
    const collapseStatic = await page.evaluate(() => window.__SS__!.perf());
    await page.locator('canvas').screenshot({ path: `${dir}/l4-collapse-${tier}.png`, scale: 'css' });
    await page.evaluate(() => window.__SS__!.camera.follow());
    const collapse = await record('true', 6_000);
    const proof = { tier, seed: 2, counts, warDrawCalls: warStatic.drawCalls, warTriangles: warStatic.triangles, collapseDrawCalls: collapseStatic.drawCalls, collapseTriangles: collapseStatic.triangles,
      warP50: percentile(war, .5), warP95: percentile(war, .95), warMax: Math.max(...war), turnMaxMs: Math.max(...turn), tankMaxMs: Math.max(...tank), breakMaxMs: Math.max(...breakFrames), collapseP50: percentile(collapse, .5), collapseP95: percentile(collapse, .95),
      simP95: percentile(warCpu.map(c => c.sim), .95), updateP95: percentile(warCpu.map(c => c.update), .95), renderP95: percentile(warCpu.map(c => c.render), .95), lineBroke: await page.evaluate(() => window.__SS__!.missions.state()!.l4!.lineBreakAt > 0) };
    writeFileSync(`${dir}/l4-${tier}.json`, JSON.stringify({ ...proof, warProfile: warStatic.profile, collapseProfile: collapseStatic.profile, war, turn, tank, breakFrames, collapse }, null, 2));
    console.log(JSON.stringify(proof));
    expect(counts.soldiers).toBeGreaterThanOrEqual(tier === 'high' ? 15 : 8); expect(counts.civilians).toBeGreaterThanOrEqual(tier === 'high' ? 20 : 8); expect(counts.infected).toBeGreaterThanOrEqual(tier === 'high' ? 20 : 10);
    expect(proof.lineBroke).toBe(true);
    for (const [draws, tris] of [[proof.warDrawCalls, proof.warTriangles], [proof.collapseDrawCalls, proof.collapseTriangles]]) { expect(draws).toBeLessThanOrEqual(tier === 'high' ? 600 : 300); expect(tris).toBeLessThanOrEqual(tier === 'high' ? 1_500_000 : 500_000); }
    // E18 frame targets: desktop high p95 within the 60 fps budget (14 ms incl. headroom); phone low >= 30 fps p50 at 4x CPU throttle.
    if (tier === 'high') { expect(proof.warP95).toBeLessThanOrEqual(14); expect(proof.collapseP95).toBeLessThanOrEqual(14); }
    else { expect(proof.warP50).toBeLessThanOrEqual(1000 / 30); expect(proof.collapseP50).toBeLessThanOrEqual(1000 / 30); }
    for (const max of [proof.turnMaxMs, proof.tankMaxMs, proof.breakMaxMs]) expect(max).toBeLessThanOrEqual(50);
  });
});
