import { devices } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { boot, expect, test } from '../e2e/fixtures';
import type { Game } from '../../src/Game';
import { l7Fires } from '../../src/levels/L7/layout';
import { l7CorridorFires } from '../../src/levels/L7/corridor';
const positions = JSON.parse(readFileSync('tests/scenes/l7-district/stress-positions.json', 'utf8')) as [number, number][];
const backend = process.env.L7_PERF_BACKEND === 'webgpu' ? 'webgpu' : 'webgl';
test.use({ channel: 'chrome', headless: true, launchOptions: { args: ['--use-angle=metal', '--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-frame-rate-limit', '--disable-gpu-vsync', '--js-flags=--expose-gc', '--enable-precise-memory-info'] } });
for (const tier of ['high', 'low'] as const) test.describe(tier, () => {
  if (tier === 'low') test.use({ userAgent: devices['Pixel 7'].userAgent, isMobile: true, hasTouch: true, viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  test(`T-E29-19-district @E29-AC19 @perf W6 district ${tier} fire and rocket stress`, async ({ page, context }) => {
  test.setTimeout(180_000);
  if (tier === 'low') {
    await page.setViewportSize({ width: 390, height: 844 });
    const cdp = await context.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  }
  await boot(page, `/?test=1&scenelab=1${backend === 'webgl' ? '&renderer=webgl' : ''}&quality=${tier}&audio=muted&dpr=1${process.env.L7_PERF_DIAG === '1' ? '&loadProfile=1' : ''}`);
  const profileSession = process.env.L7_PERF_PROFILE === '1' ? await context.newCDPSession(page) : null;
  let profileData: unknown;
  if (profileSession) await page.exposeFunction('__perfSweepStartProfile', async () => {
    await profileSession.send('Profiler.enable'); await profileSession.send('Profiler.setSamplingInterval', { interval: 500 }); await profileSession.send('Profiler.start');
  });
  if (profileSession) await page.exposeFunction('__perfSweepStopProfile', async () => { profileData = (await profileSession.send('Profiler.stop')).profile; });
  const result = await page.evaluate(async ({ tier, positions, diagnose, profile }) => {
    const a = window.__SS__!, cap = tier === 'high' ? 200 : 100;
    await a.loadLevel('L7', { seed: 29 }); a.cheats.god(true); a.settings.set({ slowMotion: false }); a.debug.figureJoints(false);
    const game = (window.__SCENE__ as unknown as { game: Game }).game;
    // The corridor extension changed a few collision cells since this fixed
    // stress list was authored. Keep the same plaza/caps and fill legal nearby
    // points rather than throwing halfway through population.
    const candidates = [...positions];
    for (let z = -20; z <= 32.5; z += 1.2) for (let x = -34; x <= -4; x += 1.2) candidates.push([x, z]);
    const legal = candidates.filter(([x, z]) => game.world.infected!.nav.clear(x, z, .35));
    if (legal.length < cap) throw new Error(`Only ${legal.length}/${cap} legal plaza crowd points`);
    a.teleport('player', { x: -19, z: 0 });
    for (const e of a.query({}).filter(e => e.companion)) a.teleport(e.id, { x: -21, z: 2 });
    // Use the authored plaza pair pose directly; a teleport must not stream
    // every intermediate Northgate building through a cross-city camera flight.
    a.camera.cinematic({ position: [3, 24, 23], target: [-17, 0, 3] }, true);
    const fireCount = () => a.query({ kind: 'hazard' }).filter(e => e.hazard?.kind === 'fire' && e.hazard.activeUntil > a.tick()).length;
    const firesStart = fireCount();
    const populate = () => {
      const ai = a.perf().infected!, missing = Math.min(cap - ai.count, ai.available);
      for (let i = 0; i < missing; i++) a.spawn('infected.runner', { x: legal[i][0], z: legal[i][1] });
    };
    populate(); await a.screenshotReady(); a.resume();
    const warm = performance.now(); while (performance.now() - warm < 3000) await new Promise(r => requestAnimationFrame(r));
    a.pause(); (window as unknown as { gc(): void }).gc();
    if (profile) await (window as unknown as { __perfSweepStartProfile(): Promise<void> }).__perfSweepStartProfile();
    // Drain setup GC/profiler timestamps while paused, as in the campaign
    // probe. Otherwise the first measured RAF includes the forced collection.
    for (let i = 0; i < 2; i++) await new Promise(r => requestAnimationFrame(r));
    const programsBefore = { ...a.perf().nodeBuildMaterials }, pipelines: unknown[] = [];
    const renderBackend = game.view.renderer.backend as unknown as { createRenderPipeline(...args: unknown[]): unknown };
    const originalPipeline = renderBackend.createRenderPipeline;
    if (diagnose) renderBackend.createRenderPipeline = function (...args) {
      const start = performance.now(), result = originalPipeline.apply(this, args);
      const object = args[0] as { material: { name: string; type: string }; object: { name: string; geometry: { attributes: object }; userData: Record<string, unknown> } };
      pipelines.push({ ms: performance.now() - start, tick: a.tick(), material: object.material.name || object.material.type, object: object.object.name, attributes: Object.keys(object.object.geometry.attributes), static: !!object.object.userData.staticInstanceAttributes });
      return result;
    };
    const frames: number[] = [], sims: number[] = [], simFrames: number[] = [], draws: number[] = [], triangles: number[] = [];
    const hitches: unknown[] = [];
    const costs: Record<string, number>[] = [];
    const samples: { ms: number; costs: Record<string, number> }[] = [];
    if (diagnose) a.debug.cpuProfile();
    let previous = 0, lastBlast = 0, lastProbe = 0, peakInfected = 0, peakPuffs = 0, peakParts = 0, peakParticles = 0, heroLights = 0, awakeProps = 0, blasts = 0;
    a.resume(); const start = performance.now();
    while (performance.now() - start < 8000) {
      const now = await new Promise<number>(r => requestAnimationFrame(r));
      if (previous) frames.push(now - previous); previous = now;
      const perf = a.perf(); if (perf.simTickMs > 0) sims.push(perf.simTickMs); simFrames.push(perf.simMs); draws.push(perf.drawCalls); triangles.push(perf.triangles);
      if (diagnose) { const cost = a.debug.cpuProfile(); costs.push(cost); if (frames.length) samples.push({ ms: frames.at(-1)!, costs: cost }); }
      if (frames.at(-1)! > 50) hitches.push({ frame: frames.length, ms: frames.at(-1), elapsed: now - start, sim: perf.simMs, update: perf.updateCpuMs, render: perf.renderCpuMs, nodeBuilds: perf.nodeBuilds });
      heroLights = Math.max(heroLights, perf.lighting?.heroLights ?? 0); awakeProps = Math.max(awakeProps, perf.awakeProps);
      if (now - lastBlast >= 1250) { a.explosions.blast('explosion.rocket', { x: -26, z: -4 }); lastBlast = now; blasts++; }
      if (now - lastProbe >= 100) {
        lastProbe = now; peakInfected = Math.max(peakInfected, perf.infected!.count);
        const fx = perf.effects!; peakPuffs = Math.max(peakPuffs, fx.blasts.puffs); peakParts = Math.max(peakParts, fx.blasts.parts); peakParticles = Math.max(peakParticles, fx.particles + fx.blasts.puffs);
        populate();
      }
    }
    a.pause();
    if (diagnose) renderBackend.createRenderPipeline = originalPipeline;
    if (profile) await (window as unknown as { __perfSweepStopProfile(): Promise<void> }).__perfSweepStopProfile();
    (window as unknown as { gc(): void }).gc();
    const live = game.world.infected!.active.filter(e => e.health.current > 0);
    const civilians = (game.view as unknown as { npcs: { civilians: { batches: { poses?: { states: Map<number, { clip: string }> }; probe: { figures: { id: number }[] } }[] } } }).npcs.civilians;
    const bakedFigures = civilians.batches.reduce((n, b) => n + b.probe.figures.filter(f => b.poses?.states.get(f.id)?.clip.endsWith(':baked')).length, 0);
    const motion = { bakedFigures, live: live.length, barelyMoving: live.filter(e => (e.motion?.speed ?? 0) <= .6).length, states: Object.fromEntries([...new Set(live.map(e => e.infected!.state))].map(state => [state, live.filter(e => e.infected!.state === state).length])) };
    const gl = document.querySelector('canvas')!.getContext('webgl2'), extension = gl?.getExtension('WEBGL_debug_renderer_info');
    const gpu = extension ? String(gl!.getParameter(extension.UNMASKED_RENDERER_WEBGL)) : null;
    const p95 = (v: number[], fraction = .95) => [...v].sort((a, b) => a - b)[Math.ceil(v.length * fraction) - 1];
    return { motion, gpu, touchPoints: navigator.maxTouchPoints, firesStart, firesEnd: fireCount(), tier, backend: a.perf().backend, blasts, peakInfected, frameP50: p95(frames, .5), frameP95: p95(frames), frameP99: p95(frames, .99), hitch: Math.max(...frames), simP95: p95(sims), simFrameP95: p95(simFrames), draws: Math.max(...draws), triangles: Math.max(...triangles), heapMB: (a.perf().heapBytes ?? 0) / 1048576, peakPuffs, peakParts, peakParticles, heroLights, awakeProps, hitches,
      samples, pipelines, newPrograms: Object.fromEntries(Object.entries(a.perf().nodeBuildMaterials).map(([key, count]) => [key, count - (programsBefore[key] ?? 0)]).filter(([, count]) => Number(count) > 0)),
      costs: costs.length ? Object.fromEntries(Object.keys(costs[0]).map(key => [key, p95(costs.map(c => c[key]))])) : null };
  }, { tier, positions, diagnose: process.env.L7_PERF_DIAG === '1', profile: !!profileSession });
  const heapSession = await context.newCDPSession(page);
  await heapSession.send('HeapProfiler.collectGarbage');
  // Settle deferred ArrayBuffer collection across task boundaries before the
  // retained-heap reading (timing samples above remain untouched).
  for (let i = 0; i < 3; i++) {
    await heapSession.send('HeapProfiler.collectGarbage');
    await page.evaluate(() => new Promise(r => requestAnimationFrame(r)));
  }
  result.heapMB = await page.evaluate(() => (window.__SS__!.perf().heapBytes ?? 0) / 1048576);
  const output = process.env.L7_PERF_OUTPUT ?? 'test-results/epics/E29';
  mkdirSync(output, { recursive: true }); writeFileSync(`${output}/district-perf-${tier}${backend === 'webgpu' ? '-webgpu' : ''}.json`, JSON.stringify(result, null, 2));
  if (profileSession) writeFileSync(`${output}/district-perf-${tier}.cpuprofile`, JSON.stringify(profileData));
  console.log(JSON.stringify(result));
  await page.locator('canvas').screenshot({ path: `${output}/district-${tier}.png` });
  expect(result.backend).toBe(backend);
  if (backend === 'webgl') { expect(result.gpu).toBeTruthy(); expect(result.gpu).not.toMatch(/swiftshader|llvmpipe|software/i); }
  if (tier === 'low') expect(result.touchPoints).toBeGreaterThan(0);
  const authoredFires = l7Fires.length + l7CorridorFires.length;
  expect(result.firesStart).toBe(authoredFires); expect(result.firesEnd).toBe(authoredFires);
  expect(result.blasts).toBeGreaterThanOrEqual(6); expect(result.peakInfected).toBe(capFor(tier));
  expect(result.draws).toBeLessThanOrEqual(tier === 'high' ? 600 : 300); expect(result.triangles).toBeLessThanOrEqual(tier === 'high' ? 1_500_000 : 500_000);
  expect(result.simP95).toBeLessThanOrEqual(tier === 'high' ? 4 : 6); expect(result.heapMB).toBeLessThanOrEqual(tier === 'high' ? 400 : 250);
  expect(result.peakPuffs).toBeLessThanOrEqual(tier === 'high' ? 400 : 120); expect(result.peakParts).toBeLessThanOrEqual(tier === 'high' ? 120 : 40);
  expect(result.peakParticles).toBeLessThanOrEqual(tier === 'high' ? 6000 : 2000); expect(result.heroLights).toBeLessThanOrEqual(tier === 'high' ? 8 : 3); expect(result.awakeProps).toBeLessThanOrEqual(tier === 'high' ? 150 : 60);
  expect(result.frameP95).toBeLessThanOrEqual(tier === 'high' ? 16.7 : 33.3);
  if (tier === 'low' && process.env.L7_PHONE_MARGIN === '1') expect(result.frameP95, 'Phone stress needs at least 10% frame headroom').toBeLessThanOrEqual(33.3 * .9);
});
});
function capFor(tier: 'high' | 'low') { return tier === 'high' ? 200 : 100; }
