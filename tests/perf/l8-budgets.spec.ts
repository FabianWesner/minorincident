import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { boot, expect, test } from '../e2e/fixtures';
// The quiet gate may queue for a long time. Rebuild after acquiring its locks, before any page loads.
test.beforeAll(() => { execFileSync('npm', ['run', 'build'], { stdio: 'inherit' }); });
test.use({ channel: 'chrome', headless: true, launchOptions: { args: ['--use-angle=metal', '--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-frame-rate-limit', '--disable-gpu-vsync', '--js-flags=--expose-gc', '--enable-precise-memory-info'] } });
for (const profile of ['high', 'low', 'phone'] as const) test(`T-E30-budget @E30-AC20 @perf ${profile} mixed outbreak E18 budgets`, async ({ page, context }) => {
  test.setTimeout(240_000); const low = profile !== 'high', tier = low ? 'low' : 'high';
  if (profile === 'phone') { await page.setViewportSize({ width: 390, height: 844 }); const cdp = await context.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); }
  await boot(page, `/?test=1&renderer=webgl&quality=${tier}&audio=muted&dpr=1`);
  const profiler = process.env.MI_L8_CPU_PROFILE === profile ? await context.newCDPSession(page) : null;
  if (profiler) { await profiler.send('Profiler.enable'); await profiler.send('Profiler.start'); }
  const result = await page.evaluate(async tier => {
    const a = window.__SS__!; await a.loadScenario('perf-l8-mixed-outbreak', { seed: 1 }); a.pause();
    a.settings.set({ slowMotion: false });
    a.camera.cinematic({ position: [-41, 23, 7], target: [-60, .5, -12] }, true);
    await a.screenshotReady(); a.resume();
    const warm = performance.now(); while (performance.now() - warm < 3000) await new Promise(r => requestAnimationFrame(r));
    const frames: number[] = [], sims: number[] = [], simFrames: number[] = []; let prev = 0, draws = 0, triangles = 0, lights = 0, peak = 0;
    const start = performance.now();
    while (performance.now() - start < 8000) {
      const now = await new Promise<number>(r => requestAnimationFrame(r)), p = a.perf();
      // Remove floating subtraction noise (33.300000000001 ms) at a picosecond, below the clock's resolution.
      if (prev) frames.push(Math.round((now - prev) * 1e9) / 1e9); prev = now;
      // E18-AC02 budgets one fixed tick, as measured by its Node runner. A phone render frame can contain several.
      if (p.simTickMs > 0) sims.push(p.simTickMs); simFrames.push(p.simMs);
      draws = Math.max(draws, p.drawCalls); triangles = Math.max(triangles, p.triangles); lights = Math.max(lights, p.lighting?.heroLights ?? 0); peak = Math.max(peak, p.infected!.count);
    }
    a.pause(); const p95 = (v: number[]) => v.sort((a,b) => a-b)[Math.ceil(v.length * .95) - 1];
    const all = a.query({});
    return { tier, frameP95: p95(frames), simP95: p95(sims), simFrameP95: p95(simFrames), draws, triangles, lights, peak, heapMB: 0,
      species: Object.fromEntries(['lion','gorilla','elephant','zebra','flamingo','alpha','runner'].map(s => [s, all.filter(e => e.archetype === `infected.${s}`).length])), perf: a.perf() };
  }, tier);
  if (profiler) { const cpu = await profiler.send('Profiler.stop'); writeFileSync(`/tmp/l8-cpu-${profile}.json`, JSON.stringify(cpu.profile)); }
  const cdp = await context.newCDPSession(page);
  // As in the existing L7 budget gate, settle deferred ArrayBuffer collection across task boundaries.
  for (let i = 0; i < 3; i++) { await cdp.send('HeapProfiler.collectGarbage'); await page.evaluate(() => new Promise(r => requestAnimationFrame(r))); }
  const heapAudit = await cdp.send('Runtime.getHeapUsage');
  // E18 memory gates use Runtime.getHeapUsage.usedSize for the JS heap;
  // performance.memory also includes Rapier WASM and geometry ArrayBuffer backing stores.
  result.heapMB = heapAudit.usedSize / 1_000_000;
  mkdirSync('test-results/epics/E30', { recursive: true }); writeFileSync(`test-results/epics/E30/perf-${profile}.json`, JSON.stringify({ ...result, heapAudit }, null, 2)); console.log(JSON.stringify({ ...result, perf: undefined, heapAudit }));
  expect(result.peak).toBe(low ? 100 : 200); for (const count of Object.values(result.species)) expect(count).toBeGreaterThan(0);
  expect(result.frameP95).toBeLessThanOrEqual(low ? 33.3 : 16.7); expect(result.simP95).toBeLessThanOrEqual(low ? 6 : 4);
  expect(result.draws).toBeLessThanOrEqual(low ? 300 : 600); expect(result.triangles).toBeLessThanOrEqual(low ? 500000 : 1500000); expect(result.heapMB).toBeLessThanOrEqual(low ? 250 : 400); expect(result.lights).toBeLessThanOrEqual(low ? 3 : 8);
});

for (const backend of ['webgl', 'webgpu'] as const) for (const tier of ['high', 'low'] as const) {
  test(`T-E30-20-transitions @E30-AC20 @perf real timed breach and systemic conversions ${backend} ${tier}`, async ({ page, context }) => {
    test.setTimeout(180_000);
    const low = tier === 'low';
    await boot(page, `/?test=1&scenelab&renderer=${backend}&quality=${tier}&audio=muted&dpr=1`);
    await page.mouse.click(200, 250);
    const result = await page.evaluate(async tier => {
      const a = window.__SS__!, game = (window.__SCENE__ as unknown as { game: import('../../src/Game').Game }).game;
      await a.loadLevel('L8', { seed: 1, progression: 'L8-default' }); a.missions.begin(); a.pause(); a.cheats.god(true);
      a.settings.set({ quality: tier, captions: true, muted: false }); await a.audio.unlock();
      a.teleport('player', { x: -60, z: -10 }); a.camera.follow(); await a.step(3540); await a.screenshotReady();
      const events: { type: string; at: number; tick: number; id?: number; species?: string }[] = [];
      const stopBreach = game.world.events.on('checkpoint.set', event => {
        if (event.type === 'checkpoint.set' && event.id === 'breach') events.push({ type: 'breach', at: performance.now(), tick: event.tick });
      });
      const stopTurns = game.world.events.on('civilian.turned', event => {
        if (event.type === 'civilian.turned') events.push({ type: 'conversion', at: performance.now(), tick: event.tick, id: event.id, species: game.world.entities.get(event.id)?.archetype });
      });
      const frames: { at: number; ms: number; tick: number }[] = [], sims: number[] = [];
      const peak = { draws: 0, triangles: 0, infected: 0, voices: 0, particles: 0, puffs: 0, gibs: 0, debris: 0, awakeProps: 0, heroLights: 0, heroShadow: 0, corpses: 0 };
      // A real RAF sample spans the authored breach; no event/state injection.
      await new Promise(r => requestAnimationFrame(r)); let previous = performance.now();
      a.resume(); const start = performance.now();
      while (performance.now() - start < 45_000) {
        const at = await new Promise<number>(r => requestAnimationFrame(r)), p = a.perf();
        frames.push({ at, ms: at - previous, tick: a.tick() }); previous = at;
        if (p.simTickMs > 0) sims.push(p.simTickMs);
        peak.draws = Math.max(peak.draws, p.drawCalls); peak.triangles = Math.max(peak.triangles, p.triangles);
        peak.infected = Math.max(peak.infected, p.infected?.liveCount ?? 0); peak.voices = Math.max(peak.voices, game.audio.graph.active.size + game.audio.score.voices);
        peak.particles = Math.max(peak.particles, (p.effects?.particles ?? 0) + (p.effects?.blasts.puffs ?? 0)); peak.puffs = Math.max(peak.puffs, p.effects?.blasts.puffs ?? 0);
        peak.gibs = Math.max(peak.gibs, p.effects?.gibs ?? 0); peak.debris = Math.max(peak.debris, p.effects?.blasts.parts ?? 0);
        peak.awakeProps = Math.max(peak.awakeProps, p.awakeProps); peak.heroLights = Math.max(peak.heroLights, p.lighting?.heroLights ?? 0); peak.heroShadow = Math.max(peak.heroShadow, p.lighting?.heroShadow ?? 0);
        if (frames.length % 30 === 0) peak.corpses = Math.max(peak.corpses, [...game.world.entities.iterate()].filter(e => e.corpse).length);
      }
      a.pause(); stopBreach(); stopTurns();
      const p95 = (values: number[]) => values.sort((x, y) => x - y)[Math.ceil(values.length * .95) - 1];
      const transitions = events.map(event => ({ ...event, frameMaxMs: Math.max(...frames.filter(f => Math.abs(f.at - event.at) <= 250).map(f => f.ms)) }));
      return { backend: a.perf().backend, tier, startTick: frames[0]?.tick, endTick: a.tick(), frameP95: p95(frames.map(f => f.ms)), simP95: p95(sims), peak, transitions, frames, audio: a.audio.snapshot() };
    }, tier);
    const cdp = await context.newCDPSession(page);
    for (let i = 0; i < 3; i++) { await cdp.send('HeapProfiler.collectGarbage'); await page.evaluate(() => new Promise(r => requestAnimationFrame(r))); }
    const heap = await cdp.send('Runtime.getHeapUsage');
    mkdirSync('test-results/epics/E30/transitions', { recursive: true });
    writeFileSync(`test-results/epics/E30/transitions/${backend}-${tier}.json`, JSON.stringify({ ...result, heap }, null, 2));
    expect.soft(result.backend).toBe(backend);
    expect.soft(result.transitions.filter(e => e.type === 'breach')).toHaveLength(1);
    expect.soft(result.transitions.some(e => e.type === 'conversion' && /infected\.(lion|gorilla|elephant|zebra|flamingo)/.test(e.species ?? '')), 'actual animal conversion must be observed, otherwise unmeasured').toBe(true);
    for (const event of result.transitions) expect.soft(event.frameMaxMs, `${event.type} tick${event.tick}`).toBeLessThanOrEqual(50);
    expect.soft(result.frameP95).toBeLessThanOrEqual(low ? 33.3 : 16.7); expect.soft(result.simP95).toBeLessThanOrEqual(low ? 6 : 4);
    expect.soft(result.peak.draws).toBeLessThanOrEqual(low ? 300 : 600); expect.soft(result.peak.triangles).toBeLessThanOrEqual(low ? 500000 : 1500000);
    expect.soft(result.peak.infected).toBeLessThanOrEqual(low ? 100 : 200); expect.soft(result.peak.voices).toBeLessThanOrEqual(low ? 16 : 32);
    expect.soft(result.peak.particles).toBeLessThanOrEqual(low ? 2000 : 6000); expect.soft(result.peak.puffs).toBeLessThanOrEqual(low ? 120 : 400);
    expect.soft(result.peak.gibs).toBeLessThanOrEqual(low ? 30 : 80); expect.soft(result.peak.debris).toBeLessThanOrEqual(low ? 40 : 120);
    expect.soft(result.peak.awakeProps).toBeLessThanOrEqual(low ? 60 : 150); expect.soft(result.peak.heroLights).toBeLessThanOrEqual(low ? 3 : 8); expect.soft(result.peak.heroShadow).toBeLessThanOrEqual(low ? 0 : 1);
    expect.soft(heap.usedSize / 1e6).toBeLessThanOrEqual(low ? 250 : 400);
  });
}
