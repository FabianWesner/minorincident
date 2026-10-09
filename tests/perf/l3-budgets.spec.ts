import { mkdirSync, writeFileSync } from 'node:fs';
import { devices } from '@playwright/test';
import { test, expect } from '../e2e/fixtures';

/** E21-AC21: the station attack (officers firing, >= 30 infected) and Grove Boulevard (fires, smoke columns, wrecks) within the
 * E18 budgets (desktop high, phone low), and no frame > 50 ms at the fallback call. One worker, native GPU, under e2e-lock.
 * Setup steps the paused sim (the L3 bot, ordinary inputs); measurements run the real clock. */
const dir = 'test-results/epics/E21/perf';
test.use({ channel: 'chrome', headless: true, launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-frame-rate-limit', '--disable-gpu-vsync'] } });
for (const tier of ['high', 'low'] as const) test.describe(tier, () => {
  if (tier === 'low') test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: devices['Pixel 7'].deviceScaleFactor, userAgent: devices['Pixel 7'].userAgent, isMobile: true, hasTouch: true });
  test(`T-E21-21 @E21 @E21-AC21 @perf L3 station attack, fallback and Grove Boulevard ${tier}`, async ({ page, context }) => {
    test.setTimeout(900_000); mkdirSync(dir, { recursive: true });
    if (tier === 'low') { const cdp = await context.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); }
    await page.goto(`/?test=1&renderer=webgl&quality=${tier}&audio=muted&dpr=${tier === 'high' ? 1 : 1.5}&profile`);
    await page.waitForFunction(() => Boolean(window.__SS__));
    await page.evaluate(async () => { const a = window.__SS__!; await a.ready; await a.loadLevel('L3', { seed: 2, progression: 'L3-default' }); a.pause(); a.missions.begin(); a.cheats.god(true); a.bot.start('complete'); });
    const step = async (until: string, max = 400) => { for (let i = 0; i < max && !await page.evaluate(until); i++) await page.evaluate(() => window.__SS__!.step(30)); };
    /** rAF frame times while the real clock runs, until `until` holds (plus `tail` ms). */
    const record = (until: string, tail: number) => page.evaluate(async ({ until, tail }) => {
      const a = window.__SS__!, frames: number[] = [], cpu: { sim: number; update: number; render: number }[] = []; let previous = 0, end = 0; a.resume();
      for (let i = 0; i < 4000; i++) {
        const now = await new Promise<number>(resolve => requestAnimationFrame(resolve));
        if (previous && i > 2) { frames.push(now - previous); const p = a.perf(); cpu.push({ sim: p.simMs, update: p.updateCpuMs, render: p.renderCpuMs }); } previous = now;
        if (!end && (0, eval)(until)) end = now + tail;
        if (end && now >= end) break;
      }
      a.pause(); (window as unknown as { l3Cpu: typeof cpu }).l3Cpu = cpu; return frames;
    }, { until, tail });
    const percentile = (values: number[], fraction: number) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * fraction) - 1];
    // The attack peak: the officers firing and >= 30 infected up (low: >= 15), at the game camera of l3-station-attack.
    await step(`window.__SS__.getState().ai.count >= ${tier === 'high' ? 30 : 15} || window.__SS__.missions.state().l3.fallbackAt > 0`, 400);
    const counts = await page.evaluate(() => { const a = window.__SS__!, all = a.query({}); return { infected: a.getState().ai!.count, officers: all.filter(e => e.civilian?.ally?.role === 'officer' && e.health.current > 0 && e.kind !== 'infected').length }; });
    await page.evaluate(async () => { const a = window.__SS__!; a.camera.preset('D-CORRIDOR/W2/l3-station-attack'); await a.screenshotReady(); });
    const attackStatic = await page.evaluate(() => window.__SS__!.perf());
    await page.locator('canvas').screenshot({ path: `${dir}/l3-station-attack-${tier}.png`, scale: 'css' });
    await page.evaluate(() => window.__SS__!.camera.follow());
    const attack = await record('true', 8_000);
    const attackCpu = await page.evaluate(() => (window as unknown as { l3Cpu: { sim: number; update: number; render: number }[] }).l3Cpu);
    // The fallback call: record from just before it to 2 s after.
    await step('window.__SS__.missions.state().l3.fallbackAt > 0 || window.__SS__.missions.state().l3.waveIds.length >= 30', 400);
    const fallback = await record('window.__SS__.missions.state().l3.fallbackAt > 0', 2_000);
    // Grove Boulevard: the jam, wrecked buses, fires and smoke columns at the photo spot's fixed camera.
    await step('window.__SS__.getState().player.transform.x > -20', 800);
    await page.evaluate(async () => { const a = window.__SS__!; a.camera.preset('D-CORRIDOR/W2/l3-grove-boulevard'); await a.screenshotReady(); });
    const blvdStatic = await page.evaluate(() => window.__SS__!.perf());
    await page.locator('canvas').screenshot({ path: `${dir}/l3-grove-boulevard-${tier}.png`, scale: 'css' });
    const blvd = await record('true', 6_000);
    const vfx = await page.evaluate(() => (window.__SS__!.getState() as unknown as { render?: { vfx?: { particles?: number; columns?: number } } }).render?.vfx ?? null);
    // Measure the occupied final street at the game camera, including pursuing packs and army HMG effects.
    await page.evaluate(() => window.__SS__!.camera.follow());
    await step('window.__SS__.getState().player.transform.x >= 110', 1200);
    await page.evaluate(async () => { const a = window.__SS__!; a.bot.stop(); a.input.clear(); await a.screenshotReady(); });
    const streetStatic = await page.evaluate(() => window.__SS__!.perf());
    const streetCounts = await page.evaluate(() => { const a = window.__SS__!, s = a.missions.state()!.l3!; return { infected: a.getState().ai!.count, spawned: s.segmentIds.flat().length + s.spillIds.length + s.pressureIds.length + (s.finaleIds?.length ?? 0) }; });
    await page.locator('canvas').screenshot({ path: `${dir}/l3-finale-${tier}.png`, scale: 'css' });
    const street = await record('true', 6_000);
    const proof = { tier, seed: 2, counts, streetCounts, streetDrawCalls: streetStatic.drawCalls, streetTriangles: streetStatic.triangles, streetP50: percentile(street, .5), streetP95: percentile(street, .95), attackDrawCalls: attackStatic.drawCalls, attackTriangles: attackStatic.triangles, blvdDrawCalls: blvdStatic.drawCalls, blvdTriangles: blvdStatic.triangles,
      attackP50: percentile(attack, .5), attackP95: percentile(attack, .95), attackMax: Math.max(...attack), fallbackMaxMs: Math.max(...fallback), blvdP50: percentile(blvd, .5), blvdP95: percentile(blvd, .95),
      simP95: percentile(attackCpu.map(c => c.sim), .95), updateP95: percentile(attackCpu.map(c => c.update), .95), renderP95: percentile(attackCpu.map(c => c.render), .95), fallbackFired: await page.evaluate(() => window.__SS__!.missions.state()!.l3!.fallbackAt > 0), vfx };
    writeFileSync(`${dir}/l3-${tier}.json`, JSON.stringify({ ...proof, attackProfile: attackStatic.profile, blvdProfile: blvdStatic.profile, blvdAssets: blvdStatic.profileAssets, attack, fallback, blvd, street }, null, 2));
    console.log(JSON.stringify(proof));
    expect(counts.infected).toBeGreaterThanOrEqual(tier === 'high' ? 30 : 15); expect(counts.officers).toBeGreaterThanOrEqual(6);
    expect(proof.fallbackFired).toBe(true);
    for (const [draws, tris] of [[proof.attackDrawCalls, proof.attackTriangles], [proof.blvdDrawCalls, proof.blvdTriangles], [proof.streetDrawCalls, proof.streetTriangles]]) { expect(draws).toBeLessThanOrEqual(tier === 'high' ? 600 : 300); expect(tris).toBeLessThanOrEqual(tier === 'high' ? 1_500_000 : 500_000); }
    // E18 frame targets: desktop high p95 within the 60 fps budget (14 ms incl. headroom); phone low >= 30 fps p50 at 4x CPU
    // throttle, the E18-AC08 emulation proxy (p95 recorded for the report).
    if (tier === 'high') { expect(proof.attackP95).toBeLessThanOrEqual(14); expect(proof.blvdP95).toBeLessThanOrEqual(14); expect(proof.streetP95).toBeLessThanOrEqual(14); }
    else { expect(proof.attackP50).toBeLessThanOrEqual(1000 / 30); expect(proof.blvdP50).toBeLessThanOrEqual(1000 / 30); expect(proof.streetP50).toBeLessThanOrEqual(1000 / 30); }
    expect(proof.fallbackMaxMs).toBeLessThanOrEqual(50);
  });
});
