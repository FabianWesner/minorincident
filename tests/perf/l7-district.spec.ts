import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { boot, expect, test } from '../e2e/fixtures';
const positions = JSON.parse(readFileSync('tests/scenes/l7-district/stress-positions.json', 'utf8')) as [number, number][];
test.use({ channel: 'chrome', headless: true, launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-frame-rate-limit', '--disable-gpu-vsync', '--js-flags=--expose-gc', '--enable-precise-memory-info'] } });
for (const tier of ['high', 'low'] as const) test(`T-E29-19-district @E29-AC19 @perf W6 district ${tier} fire and rocket stress`, async ({ page, context }) => {
  test.setTimeout(180_000);
  if (tier === 'low') {
    await page.setViewportSize({ width: 390, height: 844 });
    const cdp = await context.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  }
  await boot(page, `/?test=1&renderer=webgl&quality=${tier}&audio=muted&dpr=1`);
  const result = await page.evaluate(async ({ tier, positions }) => {
    const a = window.__SS__!, cap = tier === 'high' ? 200 : 100;
    await a.loadLevel('L7', { seed: 29 }); a.cheats.god(true); a.settings.set({ slowMotion: false });
    a.teleport('player', { x: -19, z: 0 });
    for (const e of a.query({}).filter(e => e.companion)) a.teleport(e.id, { x: -21, z: 2 });
    // Use the authored plaza pair pose directly; a teleport must not stream
    // every intermediate Northgate building through a cross-city camera flight.
    a.camera.cinematic({ position: [3, 24, 23], target: [-17, 0, 3] }, true);
    const fireCount = () => a.query({ kind: 'hazard' }).filter(e => e.hazard?.kind === 'fire' && e.hazard.activeUntil > a.tick()).length;
    const firesStart = fireCount();
    const populate = () => {
      const ai = a.perf().infected!, missing = Math.min(cap - ai.count, ai.available);
      for (let i = 0; i < missing; i++) a.spawn('infected.runner', { x: positions[i][0], z: positions[i][1] });
    };
    populate(); await a.screenshotReady(); a.resume();
    const warm = performance.now(); while (performance.now() - warm < 3000) await new Promise(r => requestAnimationFrame(r));
    (window as unknown as { gc(): void }).gc();
    const frames: number[] = [], sims: number[] = [], draws: number[] = [], triangles: number[] = [];
    let previous = 0, lastBlast = 0, lastProbe = 0, peakInfected = 0, peakPuffs = 0, peakParts = 0, peakParticles = 0, heroLights = 0, awakeProps = 0, blasts = 0;
    const start = performance.now();
    while (performance.now() - start < 8000) {
      const now = await new Promise<number>(r => requestAnimationFrame(r));
      if (previous) frames.push(now - previous); previous = now;
      const perf = a.perf(); sims.push(perf.simMs); draws.push(perf.drawCalls); triangles.push(perf.triangles);
      heroLights = Math.max(heroLights, perf.lighting?.heroLights ?? 0); awakeProps = Math.max(awakeProps, perf.awakeProps);
      if (now - lastBlast >= 1250) { a.explosions.blast('explosion.rocket', { x: -26, z: -4 }); lastBlast = now; blasts++; }
      if (now - lastProbe >= 100) {
        lastProbe = now; peakInfected = Math.max(peakInfected, perf.infected!.count);
        const fx = perf.effects!; peakPuffs = Math.max(peakPuffs, fx.blasts.puffs); peakParts = Math.max(peakParts, fx.blasts.parts); peakParticles = Math.max(peakParticles, fx.particles + fx.blasts.puffs);
        populate();
      }
    }
    a.pause(); (window as unknown as { gc(): void }).gc();
    const p95 = (v: number[]) => [...v].sort((a, b) => a - b)[Math.ceil(v.length * .95) - 1];
    return { firesStart, firesEnd: fireCount(), tier, blasts, peakInfected, frameP95: p95(frames), simP95: p95(sims), draws: Math.max(...draws), triangles: Math.max(...triangles), heapMB: (a.perf().heapBytes ?? 0) / 1048576, peakPuffs, peakParts, peakParticles, heroLights, awakeProps };
  }, { tier, positions });
  const heapSession = await context.newCDPSession(page);
  await heapSession.send('HeapProfiler.collectGarbage');
  // Settle deferred ArrayBuffer collection across task boundaries before the
  // retained-heap reading (timing samples above remain untouched).
  for (let i = 0; i < 3; i++) {
    await heapSession.send('HeapProfiler.collectGarbage');
    await page.evaluate(() => new Promise(r => requestAnimationFrame(r)));
  }
  result.heapMB = await page.evaluate(() => (window.__SS__!.perf().heapBytes ?? 0) / 1048576);
  mkdirSync('test-results/epics/E29', { recursive: true }); writeFileSync(`test-results/epics/E29/district-perf-${tier}.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  expect(result.firesStart).toBe(22); expect(result.firesEnd).toBe(22);
  expect(result.blasts).toBeGreaterThanOrEqual(6); expect(result.peakInfected).toBe(capFor(tier));
  expect(result.draws).toBeLessThanOrEqual(tier === 'high' ? 600 : 300); expect(result.triangles).toBeLessThanOrEqual(tier === 'high' ? 1_500_000 : 500_000);
  expect(result.simP95).toBeLessThanOrEqual(tier === 'high' ? 4 : 6); expect(result.heapMB).toBeLessThanOrEqual(tier === 'high' ? 400 : 250);
  expect(result.peakPuffs).toBeLessThanOrEqual(tier === 'high' ? 400 : 120); expect(result.peakParts).toBeLessThanOrEqual(tier === 'high' ? 120 : 40);
  expect(result.peakParticles).toBeLessThanOrEqual(tier === 'high' ? 6000 : 2000); expect(result.heroLights).toBeLessThanOrEqual(tier === 'high' ? 8 : 3); expect(result.awakeProps).toBeLessThanOrEqual(tier === 'high' ? 150 : 60);
  expect(result.frameP95).toBeLessThanOrEqual(tier === 'high' ? 16.7 : 33.3);
});
function capFor(tier: 'high' | 'low') { return tier === 'high' ? 200 : 100; }
