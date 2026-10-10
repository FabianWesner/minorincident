# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: perf/l3-budgets.spec.ts >> low >> T-E21-21 @E21 @E21-AC21 @perf L3 station attack, fallback and Grove Boulevard low
- Location: tests/perf/l3-budgets.spec.ts:12:3

# Error details

```
Error: expect(received).toBeLessThanOrEqual(expected)

Expected: <= 50
Received:    66.60000000000582
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - generic:
      - generic: Reach the army checkpoint · 29 m
      - generic "Objective minimap": N ▲
      - generic "Objective direction": ➜
  - generic [ref=e4]:
    - button "Touch left" [ref=e5]:
      - generic: LEFT
    - button "Touch right" [ref=e6]:
      - generic: RIGHT
    - button "ACTION" [disabled] [ref=e7]
  - button "Touch pause" [ref=e8]: PAUSE
```

# Test source

```ts
  1  | import { mkdirSync, writeFileSync } from 'node:fs';
  2  | import { devices } from '@playwright/test';
  3  | import { test, expect } from '../e2e/fixtures';
  4  | 
  5  | /** E21-AC21: the station attack (officers firing, >= 30 infected) and Grove Boulevard (fires, smoke columns, wrecks) within the
  6  |  * E18 budgets (desktop high, phone low), and no frame > 50 ms at the fallback call. One worker, native GPU, under e2e-lock.
  7  |  * Setup steps the paused sim (the L3 bot, ordinary inputs); measurements run the real clock. */
  8  | const dir = 'test-results/epics/E21/perf';
  9  | test.use({ channel: 'chrome', headless: true, launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-frame-rate-limit', '--disable-gpu-vsync'] } });
  10 | for (const tier of ['high', 'low'] as const) test.describe(tier, () => {
  11 |   if (tier === 'low') test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: devices['Pixel 7'].deviceScaleFactor, userAgent: devices['Pixel 7'].userAgent, isMobile: true, hasTouch: true });
  12 |   test(`T-E21-21 @E21 @E21-AC21 @perf L3 station attack, fallback and Grove Boulevard ${tier}`, async ({ page, context }) => {
  13 |     test.setTimeout(900_000); mkdirSync(dir, { recursive: true });
  14 |     if (tier === 'low') { const cdp = await context.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); }
  15 |     await page.goto(`/?test=1&renderer=webgl&quality=${tier}&audio=muted&dpr=${tier === 'high' ? 1 : 1.5}&profile`);
  16 |     await page.waitForFunction(() => Boolean(window.__SS__));
  17 |     await page.evaluate(async () => { const a = window.__SS__!; await a.ready; await a.loadLevel('L3', { seed: 2, progression: 'L3-default' }); a.pause(); a.missions.begin(); a.cheats.god(true); a.bot.start('complete'); });
  18 |     const step = async (until: string, max = 400) => { for (let i = 0; i < max && !await page.evaluate(until); i++) await page.evaluate(() => window.__SS__!.step(30)); };
  19 |     /** rAF frame times while the real clock runs, until `until` holds (plus `tail` ms). */
  20 |     const record = (until: string, tail: number) => page.evaluate(async ({ until, tail }) => {
  21 |       const a = window.__SS__!, frames: number[] = [], cpu: { sim: number; update: number; render: number }[] = []; let previous = 0, end = 0; a.resume();
  22 |       for (let i = 0; i < 4000; i++) {
  23 |         const now = await new Promise<number>(resolve => requestAnimationFrame(resolve));
  24 |         if (previous && i > 2) { frames.push(now - previous); const p = a.perf(); cpu.push({ sim: p.simMs, update: p.updateCpuMs, render: p.renderCpuMs }); } previous = now;
  25 |         if (!end && (0, eval)(until)) end = now + tail;
  26 |         if (end && now >= end) break;
  27 |       }
  28 |       a.pause(); (window as unknown as { l3Cpu: typeof cpu }).l3Cpu = cpu; return frames;
  29 |     }, { until, tail });
  30 |     const percentile = (values: number[], fraction: number) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * fraction) - 1];
  31 |     // The attack peak: the officers firing and >= 30 infected up (low: >= 15), at the game camera of l3-station-attack.
  32 |     await step(`window.__SS__.getState().ai.count >= ${tier === 'high' ? 30 : 15} || window.__SS__.missions.state().l3.fallbackAt > 0`, 400);
  33 |     const counts = await page.evaluate(() => { const a = window.__SS__!, all = a.query({}); return { infected: a.getState().ai!.count, officers: all.filter(e => e.civilian?.ally?.role === 'officer' && e.health.current > 0 && e.kind !== 'infected').length }; });
  34 |     await page.evaluate(async () => { const a = window.__SS__!; a.camera.preset('D-CORRIDOR/W2/l3-station-attack'); await a.screenshotReady(); });
  35 |     const attackStatic = await page.evaluate(() => window.__SS__!.perf());
  36 |     await page.locator('canvas').screenshot({ path: `${dir}/l3-station-attack-${tier}.png`, scale: 'css' });
  37 |     await page.evaluate(() => window.__SS__!.camera.follow());
  38 |     const attack = await record('true', 8_000);
  39 |     const attackCpu = await page.evaluate(() => (window as unknown as { l3Cpu: { sim: number; update: number; render: number }[] }).l3Cpu);
  40 |     // The fallback call: record from just before it to 2 s after.
  41 |     await step('window.__SS__.missions.state().l3.fallbackAt > 0 || window.__SS__.missions.state().l3.waveIds.length >= 30', 400);
  42 |     const fallback = await record('window.__SS__.missions.state().l3.fallbackAt > 0', 2_000);
  43 |     // Grove Boulevard: the jam, wrecked buses, fires and smoke columns at the photo spot's fixed camera.
  44 |     await step('window.__SS__.getState().player.transform.x > -20', 800);
  45 |     await page.evaluate(async () => { const a = window.__SS__!; a.camera.preset('D-CORRIDOR/W2/l3-grove-boulevard'); await a.screenshotReady(); });
  46 |     const blvdStatic = await page.evaluate(() => window.__SS__!.perf());
  47 |     await page.locator('canvas').screenshot({ path: `${dir}/l3-grove-boulevard-${tier}.png`, scale: 'css' });
  48 |     const blvd = await record('true', 6_000);
  49 |     const vfx = await page.evaluate(() => (window.__SS__!.getState() as unknown as { render?: { vfx?: { particles?: number; columns?: number } } }).render?.vfx ?? null);
  50 |     // Measure the occupied final street at the game camera, including pursuing packs and army HMG effects.
  51 |     await page.evaluate(() => window.__SS__!.camera.follow());
  52 |     await step('window.__SS__.getState().player.transform.x >= 110', 1200);
  53 |     await page.evaluate(async () => { const a = window.__SS__!; a.bot.stop(); a.input.clear(); await a.screenshotReady(); });
  54 |     const streetStatic = await page.evaluate(() => window.__SS__!.perf());
  55 |     const streetCounts = await page.evaluate(() => { const a = window.__SS__!, s = a.missions.state()!.l3!; return { infected: a.getState().ai!.count, spawned: s.segmentIds.flat().length + s.spillIds.length + s.pressureIds.length + (s.finaleIds?.length ?? 0) }; });
  56 |     await page.locator('canvas').screenshot({ path: `${dir}/l3-finale-${tier}.png`, scale: 'css' });
  57 |     const street = await record('true', 6_000);
  58 |     const proof = { tier, seed: 2, counts, streetCounts, streetDrawCalls: streetStatic.drawCalls, streetTriangles: streetStatic.triangles, streetP50: percentile(street, .5), streetP95: percentile(street, .95), attackDrawCalls: attackStatic.drawCalls, attackTriangles: attackStatic.triangles, blvdDrawCalls: blvdStatic.drawCalls, blvdTriangles: blvdStatic.triangles,
  59 |       attackP50: percentile(attack, .5), attackP95: percentile(attack, .95), attackMax: Math.max(...attack), fallbackMaxMs: Math.max(...fallback), blvdP50: percentile(blvd, .5), blvdP95: percentile(blvd, .95),
  60 |       simP95: percentile(attackCpu.map(c => c.sim), .95), updateP95: percentile(attackCpu.map(c => c.update), .95), renderP95: percentile(attackCpu.map(c => c.render), .95), fallbackFired: await page.evaluate(() => window.__SS__!.missions.state()!.l3!.fallbackAt > 0), vfx };
  61 |     writeFileSync(`${dir}/l3-${tier}.json`, JSON.stringify({ ...proof, attackProfile: attackStatic.profile, blvdProfile: blvdStatic.profile, blvdAssets: blvdStatic.profileAssets, attack, fallback, blvd, street }, null, 2));
  62 |     console.log(JSON.stringify(proof));
  63 |     expect(counts.infected).toBeGreaterThanOrEqual(tier === 'high' ? 30 : 15); expect(counts.officers).toBeGreaterThanOrEqual(6);
  64 |     expect(proof.fallbackFired).toBe(true);
  65 |     for (const [draws, tris] of [[proof.attackDrawCalls, proof.attackTriangles], [proof.blvdDrawCalls, proof.blvdTriangles], [proof.streetDrawCalls, proof.streetTriangles]]) { expect(draws).toBeLessThanOrEqual(tier === 'high' ? 600 : 300); expect(tris).toBeLessThanOrEqual(tier === 'high' ? 1_500_000 : 500_000); }
  66 |     // E18 frame targets: desktop high p95 within the 60 fps budget (14 ms incl. headroom); phone low >= 30 fps p50 at 4x CPU
  67 |     // throttle, the E18-AC08 emulation proxy (p95 recorded for the report).
  68 |     if (tier === 'high') { expect(proof.attackP95).toBeLessThanOrEqual(14); expect(proof.blvdP95).toBeLessThanOrEqual(14); expect(proof.streetP95).toBeLessThanOrEqual(14); }
  69 |     else { expect(proof.attackP50).toBeLessThanOrEqual(1000 / 30); expect(proof.blvdP50).toBeLessThanOrEqual(1000 / 30); expect(proof.streetP50).toBeLessThanOrEqual(1000 / 30); }
> 70 |     expect(proof.fallbackMaxMs).toBeLessThanOrEqual(50);
     |                                 ^ Error: expect(received).toBeLessThanOrEqual(expected)
  71 |   });
  72 | });
  73 | 
```