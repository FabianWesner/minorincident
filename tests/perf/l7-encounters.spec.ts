import { collectedHeap } from './collected-heap';
import { mkdirSync, writeFileSync } from 'node:fs';
import { boot, expect, test } from '../e2e/fixtures';
test.use({ channel: 'chrome', headless: true, launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-frame-rate-limit', '--disable-gpu-vsync', '--js-flags=--expose-gc', '--enable-precise-memory-info'] } });
for (const tier of ['high', 'low'] as const) test(`T-E29-19-encounters @E29-AC19 @perf ${tier}: final horde, followers and queued arrivals`, async ({ page, context }) => {
  test.setTimeout(180_000);
  if (tier === 'low') {
    await page.setViewportSize({ width: 390, height: 844 });
    const session = await context.newCDPSession(page); await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  }
  await boot(page, `/?test=1&renderer=webgl&quality=${tier}&audio=muted&dpr=1${process.env.L7_PERF_DIAG === '1' || process.env.L7_PERF_KEYS === '1' ? '&loadProfile=1' : ''}`);
  const profiler = process.env.L7_CPU_PROFILE === '1' ? await context.newCDPSession(page) : null;
  if (profiler) { await profiler.send('Profiler.enable'); await profiler.send('Profiler.start'); }
  const result = await page.evaluate(async ({ tier, diagnose }) => {
    const a = window.__SS__!;
    await a.loadLevel('L7', { seed: 29 }); a.cheats.god(true); a.settings.set({ slowMotion: false });
    a.pause(); a.setLoadout(['weapon.bat'], ['weapon.rocket-launcher']); await a.step(2);
    const initial = a.getState().l7!;
    a.teleport('player', { x: -48, z: 46 });
    initial.roster.forEach((r, i) => a.teleport(r.id, { x: -45 + Math.floor(i / 3) * 1.2, z: 46 + (i % 3 - 1) * 1.2 }));
    a.camera.cinematic({ position: [-22, 24, 68], target: [-48, 0, 46] }, true);
    await a.screenshotReady(); a.resume();
    const warm = performance.now(); while (performance.now() - warm < 3000) await new Promise(r => requestAnimationFrame(r));
    const programsBefore = { ...a.perf().nodeBuildMaterials };
    if (diagnose) a.debug.cpuProfile();
    const costs: Record<string, number>[] = [];
    const hitches: unknown[] = [];
    const frames: number[] = [], sims: number[] = [], simFrames: number[] = [], updates: number[] = [], renders: number[] = [];
    let prev = 0, blastAt = 0, peakInfected = 0, draws = 0, triangles = 0, puffs = 0, debris = 0, particles = 0, lights = 0, props = 0, blasts = 0;
    const start = performance.now();
    while (performance.now() - start < 8000) {
      const now = await new Promise<number>(r => requestAnimationFrame(r)), p = a.perf();
      if (diagnose) costs.push(a.debug.cpuProfile());
      if (prev) frames.push(now - prev); prev = now;
      if (frames.at(-1)! > 40) hitches.push({ ms: frames.at(-1), elapsed: now - start, tick: a.tick(), sim: p.simMs, update: p.updateCpuMs, render: p.renderCpuMs, builds: p.nodeBuilds }); if (p.simTickMs > 0) sims.push(p.simTickMs); simFrames.push(p.simMs); updates.push(p.updateCpuMs); renders.push(p.renderCpuMs);
      draws = Math.max(draws, p.drawCalls); triangles = Math.max(triangles, p.triangles); peakInfected = Math.max(peakInfected, p.infected!.count);
      puffs = Math.max(puffs, p.effects!.blasts.puffs); debris = Math.max(debris, p.effects!.blasts.parts); particles = Math.max(particles, p.effects!.particles + p.effects!.blasts.puffs);
      lights = Math.max(lights, p.lighting?.heroLights ?? 0); props = Math.max(props, p.awakeProps);
      if (now - blastAt >= 1250) { a.explosions.blast('explosion.rocket', { x: -64, z: 46 }); blastAt = now; blasts++; }
    }
    a.pause();
    const p95 = (v: number[]) => v.sort((a, b) => a - b)[Math.ceil(v.length * .95) - 1];
    return { tier, hitches, newPrograms: Object.fromEntries(Object.entries(a.perf().nodeBuildMaterials).map(([key, count]) => [key, count - (programsBefore[key] ?? 0)]).filter(([, count]) => Number(count) > 0)), costs: costs.length ? Object.fromEntries(Object.keys(costs[0]).map(key => [key, p95(costs.map(c => c[key]))])) : null, frameMax: Math.max(...frames), simFrameP95: p95(simFrames), updateP95: p95(updates), renderP95: p95(renders), frameP95: p95(frames), simP95: p95(sims), draws, triangles, peakInfected, puffs, debris, particles, lights, props, blasts, initialRegulars: initial.arrivals.filter(a => a.group === 700 && !a.alpha).length, initialAlphas: initial.arrivals.filter(a => a.group === 700 && a.alpha).length, followers: initial.roster.length, heapMB: 0 };
  }, { tier, diagnose: process.env.L7_CPU_PROFILE === '1' });
  if (profiler) { mkdirSync('test-results/epics/E29', { recursive: true }); writeFileSync(`test-results/epics/E29/encounters-${tier}.cpuprofile`, JSON.stringify((await profiler.send('Profiler.stop')).profile)); await profiler.detach(); }
  const heap = await collectedHeap(page, context);
  result.heapMB = heap.heapMB;
  mkdirSync('test-results/epics/E29', { recursive: true }); writeFileSync(`test-results/epics/E29/encounters-perf-${tier}.json`, JSON.stringify({ ...result, ...heap }, null, 2)); console.log(JSON.stringify({ ...result, ...heap }));
  const low = tier === 'low';
  expect(result.initialRegulars).toBe(low ? 60 : 120); expect(result.initialAlphas).toBe(2); expect(result.followers).toBe(low ? 15 : 24);
  expect(result.peakInfected).toBe(low ? 100 : 200); expect(result.blasts).toBeGreaterThanOrEqual(6);
  expect(result.frameMax).toBeLessThanOrEqual(50);
  expect(result.frameP95).toBeLessThanOrEqual(low ? 33.3 : 16.7); expect(result.simP95).toBeLessThanOrEqual(low ? 6 : 4);
  expect(result.draws).toBeLessThanOrEqual(low ? 300 : 600); expect(result.triangles).toBeLessThanOrEqual(low ? 500000 : 1500000); expect(result.heapMB).toBeLessThanOrEqual(low ? 250 : 400);
  expect(result.puffs).toBeLessThanOrEqual(low ? 120 : 400); expect(result.debris).toBeLessThanOrEqual(low ? 40 : 120); expect(result.particles).toBeLessThanOrEqual(low ? 2000 : 6000);
  expect(result.lights).toBeLessThanOrEqual(low ? 3 : 8); expect(result.props).toBeLessThanOrEqual(low ? 60 : 150);
});
