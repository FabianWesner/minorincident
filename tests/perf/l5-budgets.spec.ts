import { mkdirSync, writeFileSync } from 'node:fs';
import { devices } from '@playwright/test';
import { test, expect } from '../e2e/fixtures';

/** E23-AC19: the L5 pair-plaza frame (W5 shells, fires, smoke columns, wrecks, the corpses, five followers) and a walk with the group stay
 * within the E18 budgets (desktop high, phone low), and the devastated frame costs no more than 20 % more draw calls than the L4 W0 frame
 * of the same camera. One worker, native GPU, under e2e-lock. Setup steps the paused sim (the L5 bot, ordinary inputs); measurements run the real clock. */
const dir = 'test-results/epics/E23/perf';
test.use({ channel: 'chrome', headless: true, launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-frame-rate-limit', '--disable-gpu-vsync'] } });
for (const tier of ['high', 'low'] as const) test.describe(tier, () => {
  if (tier === 'low') test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: devices['Pixel 7'].deviceScaleFactor, userAgent: devices['Pixel 7'].userAgent, isMobile: true, hasTouch: true });
  test(`T-E23-19 @E23 @E23-AC19 @perf L5 pair-plaza with fires, smoke and five followers, and a walk with the group, ${tier}`, async ({ page, context }) => {
    test.setTimeout(1_200_000); mkdirSync(dir, { recursive: true });
    if (tier === 'low') { const cdp = await context.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); }
    const url = `/?test=1&renderer=webgl&quality=${tier}&audio=muted&dpr=${tier === 'high' ? 1 : 1.5}&profile`;
    // The L4 W0 baseline of the same camera.
    await page.goto(url); await page.waitForFunction(() => Boolean(window.__SS__));
    await page.evaluate(async () => { const a = window.__SS__!; await a.ready; await a.loadLevel('L4', { seed: 2, progression: 'L4-default' }); a.pause(); a.missions.begin(); a.cheats.god(true); a.cheats.completeObjective('ride'); await a.step(60); a.camera.preset('D-FAIR/W0/pair-plaza'); await a.screenshotReady(); });
    const baseline = await page.evaluate(() => window.__SS__!.perf());
    await page.locator('canvas').screenshot({ path: `${dir}/l4-pair-plaza-${tier}.png`, scale: 'css' });
    // L5: everybody found, the group standing round the courier in the plaza, the fires burning.
    await page.goto(url); await page.waitForFunction(() => Boolean(window.__SS__));
    await page.evaluate(async () => {
      const a = window.__SS__!; await a.ready; await a.loadLevel('L5', { seed: 2, progression: 'L5-default' }); a.pause(); a.missions.begin(); a.cheats.god(true);
      a.cheats.completeObjective('emerge'); await a.step(11 * 60); a.cheats.completeObjective('look'); await a.step(30);
      const me = a.query({ kind: 'player' })[0].id; a.teleport(me, { x: -14, z: 8 }); await a.step(5);
      const group = a.query({}).filter(e => e.civilian?.survivor?.mode === 'follow');
      group.forEach((e, i) => a.teleport(e.id, { x: -14 - 3 + (i % 3) * 2.6, z: 8 + 3 + Math.floor(i / 3) * 2.6 }));
      await a.step(90);
    });
    const counts = await page.evaluate(() => { const a = window.__SS__!, all = a.query({}); return { followers: all.filter(e => e.civilian?.survivor?.mode === 'follow').length, infected: a.getState().ai!.count, fires: all.filter(e => e.hazard?.kind === 'fire').length, corpses: all.filter(e => e.civilian?.state === 'finished').length }; });
    await page.evaluate(async () => { const a = window.__SS__!; a.camera.preset('D-FAIR/W5/pair-plaza'); await a.screenshotReady(); });
    const pair = await page.evaluate(() => window.__SS__!.perf());
    await page.locator('canvas').screenshot({ path: `${dir}/l5-pair-plaza-${tier}.png`, scale: 'css' });
    await page.evaluate(async () => { const a = window.__SS__!; a.camera.follow(); await a.step(2); await a.screenshotReady(); });
    const follow = await page.evaluate(() => window.__SS__!.perf());
    await page.locator('canvas').screenshot({ path: `${dir}/l5-follow-${tier}.png`, scale: 'css' });
    // A walk with the group along Harbor Street (the bot, ordinary inputs), real clock, rAF frame times.
    const frames = await page.evaluate(async () => {
      const a = window.__SS__!, out: number[] = []; a.bot.start('complete'); a.resume(); let previous = 0;
      for (let i = 0; i < 1500; i++) {
        const now = await new Promise<number>(resolve => requestAnimationFrame(resolve));
        if (previous && i > 2) out.push(now - previous); previous = now;
      }
      a.pause(); return out;
    });
    const percentile = (values: number[], fraction: number) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * fraction) - 1];
    const proof = { tier, counts, baselineDrawCalls: baseline.drawCalls, baselineTriangles: baseline.triangles, pairDrawCalls: pair.drawCalls, pairTriangles: pair.triangles, followDrawCalls: follow.drawCalls, followTriangles: follow.triangles,
      p50: percentile(frames, .5), p95: percentile(frames, .95), max: Math.max(...frames) };
    writeFileSync(`${dir}/l5-${tier}.json`, JSON.stringify({ ...proof, pairProfile: pair.profile, pairAssets: pair.profileAssets, followProfile: follow.profile, frames }, null, 2));
    console.log(JSON.stringify(proof));
    expect(counts.followers).toBeGreaterThanOrEqual(5); expect(counts.fires).toBeGreaterThanOrEqual(8); expect(counts.corpses).toBeGreaterThanOrEqual(30); expect(counts.infected).toBeGreaterThanOrEqual(tier === 'high' ? 12 : 8);
    for (const [draws, tris] of [[proof.pairDrawCalls, proof.pairTriangles], [proof.followDrawCalls, proof.followTriangles]]) { expect(draws).toBeLessThanOrEqual(tier === 'high' ? 600 : 300); expect(tris).toBeLessThanOrEqual(tier === 'high' ? 1_500_000 : 500_000); }
    // No tier regression against the L4 W0 frame of the same camera: <= 20 % more draw calls.
    expect(proof.pairDrawCalls).toBeLessThanOrEqual(Math.ceil(proof.baselineDrawCalls * 1.2));
    // E18 frame targets: desktop high p95 within the 60 fps budget (14 ms incl. headroom); phone low >= 30 fps p50 at 4x CPU throttle; no hitch above 50 ms (80 ms throttled).
    if (tier === 'high') expect(proof.p95).toBeLessThanOrEqual(14); else expect(proof.p50).toBeLessThanOrEqual(1000 / 30);
    expect(proof.max).toBeLessThanOrEqual(tier === 'high' ? 50 : 80);
  });
});
