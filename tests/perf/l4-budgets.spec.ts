import { mkdirSync, writeFileSync } from 'node:fs';
import { devices } from '@playwright/test';
import { test, expect } from '../e2e/fixtures';
import type { Game } from '../../src/Game';

/** E22-AC20: the L4 war (soldiers firing, the HMG nests, the tank, the helicopter, 40+ civilians, the infected waves) and the collapse
 * within the E18 budgets (desktop high, phone low), and no frame > 50 ms at the first turn, a tank shot, the fuel-truck chain or the line
 * break. One worker, native GPU, under e2e-lock. Setup steps the paused sim (the L4 bot, ordinary inputs); measurements run the real clock.
 * Preconditions follow the l4-collapse design the PO approved ("ok let's try that!", 2026-10-12): the war peak is measured once the first
 * Alphas have arrived (84 s after the turn; the third at 150 s), and the army loses men on the beats (line 1 falls at about 60 s), so the
 * peak holds the surviving soldiers, not the 15+ of the old static line. Frame, hitch, sim, draw and triangle budgets are unchanged. */
const dir = process.env.L4_PERF_OUTPUT ?? 'test-results/epics/E22/perf';
const renderer = process.env.E2E_RENDERER === 'webgpu' ? 'webgpu' : 'webgl';
test.use({ channel: 'chrome', headless: true, launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--disable-frame-rate-limit', '--disable-gpu-vsync'] } });
for (const tier of ['high', 'low'] as const) test.describe(tier, () => {
  if (tier === 'low') test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: devices['Pixel 7'].deviceScaleFactor, userAgent: devices['Pixel 7'].userAgent, isMobile: true, hasTouch: true });
  test(`T-E22-20 @E22 @E22-AC20 @perf L4 turn, war peak, tank shot, fuel-truck chain and line break ${tier}`, async ({ page, context }) => {
    test.setTimeout(1_200_000); mkdirSync(dir, { recursive: true });
    if (tier === 'low') { const cdp = await context.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); }
    await page.goto(`/?test=1&renderer=${renderer}&quality=${tier}&audio=muted&dpr=${tier === 'high' ? 1 : 1.5}${process.env.L4_PERF_PROFILE === '1' || process.env.L4_TIMING_KEYS === '1' || process.env.L4_CPU_PROFILE === '1' ? '&profile' : ''}${process.env.L4_TIMING_KEYS === '1' ? '&scenelab=1&loadProfile=1' : ''}`);
    await page.waitForFunction(() => Boolean(window.__SS__));
    await page.evaluate(async () => { const a = window.__SS__!; await a.ready; await a.loadLevel('L4', { seed: 2, progression: 'L4-default' }); a.pause(); a.missions.begin(); a.cheats.god(true); a.bot.start('complete'); });
    expect(await page.evaluate(() => window.__SS__!.perf().backend)).toBe(renderer);
    if (process.env.L4_TIMING_KEYS === '1') await page.evaluate(() => {
      const game = (window.__SCENE__ as unknown as { game: Game }).game, world = game.world;
      window.__SS__!.debug.figureJoints(false);
      const timings: { tick: number; name: string; ms: number }[] = [];
      (window as unknown as { l4Timing: typeof timings }).l4Timing = timings;
      const builds: unknown[] = [];
      (window as unknown as { l4Builds: unknown[] }).l4Builds = builds;
      const onBuild = game.view.renderer.debug.onNodeBuilderCreated;
      game.view.renderer.debug.onNodeBuilderCreated = (builder, object) => {
        onBuild?.(builder, object);
        const draw = object as unknown as { getMaterialCacheKey(): number; getDynamicCacheKey(): number; material: { uuid: string; name: string; type: string; outputNode?: { id: number } }; object: { name: string; parent?: { name: string }; geometry?: { attributes: Record<string, { itemSize: number }> } } };
        builds.push({ tick: world.tick, material: draw.material.name || draw.material.type, uuid: draw.material.uuid, outputNode: draw.material.outputNode?.id, name: draw.object.name, parent: draw.object.parent?.name, materialKey: draw.getMaterialCacheKey(), dynamicKey: draw.getDynamicCacheKey(), attributes: Object.fromEntries(Object.entries(draw.object.geometry?.attributes ?? {}).map(([name, a]) => [name, a.itemSize])) });
      };
      const watch = (owner: object | null | undefined, names: string[]) => {
        if (!owner) return;
        const target = owner as Record<string, unknown>;
        for (const name of names) {
          const fn = target[name]; if (typeof fn !== 'function') continue;
          target[name] = (...args: unknown[]) => {
            const start = performance.now();
            try { return fn.apply(owner, args); }
            finally { const ms = performance.now() - start; if (ms > 3) timings.push({ tick: world.tick, name: `${owner.constructor.name}.${name}`, ms }); }
          };
        }
      };
      watch(world.missions?.l4, ['turn', 'emerge', 'panic', 'campCheckpoint', 'perimeter', 'toPosts']);
      watch(world.missions, ['capture', 'flushCheckpoint', 'update']);
      watch(world.npcs?.civilians.outbreak, ['update', 'flee', 'refugeSpot']);
      watch(world.npcs, ['update']); watch(world.infected, ['update']);
    });
    const profiler = process.env.L4_CPU_PROFILE === '1' ? await context.newCDPSession(page) : null;
    if (profiler) { await profiler.send('Profiler.enable'); await profiler.send('Profiler.setSamplingInterval', { interval: 500 }); await profiler.send('Profiler.start'); }
    const profileStartedAt = profiler ? await page.evaluate(() => performance.now()) : 0;
    const step = async (until: string, max = 600) => { for (let i = 0; i < max && !await page.evaluate(until); i++) await page.evaluate(() => window.__SS__!.step(15)); };
    /** rAF frame times while the real clock runs, until `until` holds (plus `tail` ms). */
    const record = (until: string, tail: number) => page.evaluate(async ({ until, tail, diagnostic }) => {
      const a = window.__SS__!, frames: number[] = [], cpu: { at: number; tick: number; sim: number; simFrame: number; ticks: number; update: number; render: number; builds: number }[] = []; let previous = 0, previousTick = a.tick(), end = 0; const deadline = performance.now() + 180_000; a.resume();
      for (let i = 0; previous < deadline; i++) {
        const now = await new Promise<number>(resolve => requestAnimationFrame(resolve));
        const tick = a.tick(), steps = tick - previousTick; previousTick = tick;
        if (previous && i > 2) { frames.push(now - previous); const p = a.perf(); cpu.push({ at: performance.now(), tick, sim: p.simTickMs, simFrame: p.simMs, ticks: steps, update: p.updateCpuMs, render: p.renderCpuMs, builds: p.nodeBuilds }); } previous = now;
        if (!end && (0, eval)(until)) end = now + tail;
        if (end && now >= end) break;
      }
      a.pause(); (window as unknown as { l4Cpu: typeof cpu }).l4Cpu = cpu;
      if (diagnostic) {
        const state = window as unknown as { l4Phases?: { frames: number[]; cpu: typeof cpu }[] };
        (state.l4Phases ??= []).push({ frames, cpu });
      }
      return frames;
    }, { until, tail, diagnostic: process.env.L4_CPU_PROFILE === '1' || process.env.L4_TIMING_KEYS === '1' });
    const percentile = (values: number[], fraction: number) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * fraction) - 1];
    const l4 = 'window.__SS__.missions.state().l4', beats = 'window.__SS__.perf().l4';
    // The ride and the calm plaza (the bot goes to the quartermaster), then the first turn.
    await step(`${l4}.phase === 'plaza'`, 800); await step(`${l4}.turnDueAt > 0 && ${l4}.turnDueAt - window.__SS__.tick() < 120`, 900);
    const turn = await record(`${beats}.turnAt > 0`, 2_000);
    // The war: from the tank's entry; the peak: HMG and rifles firing, the tank in place, the helicopter orbiting, the waves arriving.
    // Capture the requested surviving-army state after an actual loss, rather than assuming
    // that a timed Alpha entrance already killed a soldier. Recoverable bodies keep their slots.
    const armyLostSomeone = `window.__SS__.query({}).filter(e => e.civilian?.ally?.role === 'soldier' && e.health.current > 0 && e.kind !== 'infected').length < ${l4}.soldiersAtTurn`;
    await step(`${l4}.tankPhase === 'hold' && ${l4}.heliPhase === 'orbit' && ${l4}.alphaIds.length >= 3 && ${armyLostSomeone}`, 900);
    // Populate the acceptance peak through the ordinary spawn APIs. The natural route often
    // kills the early waves before tank entry, so it cannot prove the specified 80/40 stress case.
    await page.evaluate(tier => {
      const a = window.__SS__!, targetCivilians = tier === 'high' ? 40 : 20, targetInfected = tier === 'high' ? 80 : 48;
      let civilians = a.query({}).filter(e => e.civilian && !e.civilian.ally && e.health.current > 0 && !e.hidden && e.kind !== 'infected').length;
      for (let i = 0; civilians < targetCivilians && i < 600; i++) {
        const p = { x: -35 + i % 12 * 3, z: -18 + Math.floor(i / 12) * 2 };
        try { a.npcs.civilian('cashier', p, { waypoints: [p] }); civilians++; } catch { /* next walkable plaza cell */ }
      }
      // Posts are snapped to walkable cells by the mission; use the actual soldiers,
      // not their authored anchors, to put targets on open approaches to every gun.
      const posts = a.query({}).filter(e => e.civilian?.ally?.role === 'soldier' && e.health.current > 0 && e.kind !== 'infected').map(e => ({ at: e.transform, yaw: e.transform.yaw }));
      let infected = a.getState().ai!.count;
      // The Alphas are the level's own (they arrive on the design's schedule); the stress fill adds runners only.
      for (let i = 0; infected < targetInfected && i < 800; i++) {
        const post = posts[i % posts.length];
        const angle = -post.yaw + Math.floor(i / posts.length) * Math.PI / 8;
        const radius = 3 + Math.floor(i / (posts.length * 16)) % 4;
        try {
          a.spawn('infected.runner', { x: post.at.x + Math.cos(angle) * radius, z: post.at.z + Math.sin(angle) * radius }, { state: 'chase' }); infected++;
        } catch { /* try the next open approach around a soldier post */ }
      }
    }, tier);
    const counts = await page.evaluate(() => { const a = window.__SS__!, all = a.query({}); return { infected: a.getState().ai!.count, alphas: all.filter(e => e.archetype === 'infected.alpha' && e.health.current > 0).length, alphasArrived: a.missions.state()!.l4!.alphaIds.length, turnS: (a.tick() - a.missions.state()!.l4!.turnAt) / 60, soldiersAtTurn: a.missions.state()!.l4!.soldiersAtTurn, soldiers: all.filter(e => e.civilian?.ally?.role === 'soldier' && e.health.current > 0 && e.kind !== 'infected').length, civilians: all.filter(e => e.civilian && !e.civilian.ally && e.health.current > 0 && !e.hidden && e.kind !== 'infected').length }; });
    await page.evaluate(async () => { const a = window.__SS__!; a.camera.preset('D-FAIR/W0/l4-war-line'); await a.screenshotReady(); });
    const warStatic = await page.evaluate(() => window.__SS__!.perf());
    await page.locator('canvas').screenshot({ path: `${dir}/l4-war-line-${tier}.png`, scale: 'css' });
    await page.evaluate(() => window.__SS__!.camera.follow());
    const warStartTick = await page.evaluate(() => window.__SS__!.tick());
    const war = await record('true', 8_000);
    const firingSoldiers = await page.evaluate(tick => new Set(window.__SS__!.events().filter(e => e.type === 'ally.attack' && e.role === 'soldier' && e.tick >= tick).map(e => e.type === 'ally.attack' ? e.sourceId : 0)).size, warStartTick);
    const warCpu = await page.evaluate(() => (window as unknown as { l4Cpu: { sim: number; simFrame: number; ticks: number; update: number; render: number }[] }).l4Cpu);
    // A tank shot, then the line break (the fuel-truck mega chain, the helicopter pulling out).
    const shots = await page.evaluate(`${l4}.tankShots`) as number;
    const tank = await record(`${beats}.tankShots > ${shots}`, 2_000);
    // Keep the real clock running through the break itself; stepping past the
    // trigger while paused omitted the fuel-truck chain from the hitch proof.
    const breakFrames = await record(`${beats}.lineBreakAt > 0`, 5_000);
    await page.evaluate(async () => { const a = window.__SS__!; a.camera.preset('D-FAIR/W0/l4-collapse'); await a.screenshotReady(); });
    await page.locator('canvas').screenshot({ path: `${dir}/l4-collapse-${tier}.png`, scale: 'css' });
    // Draw/triangle budgets are measured on the gameplay (follow) camera; the photo preset is a wide overview.
    await page.evaluate(async () => { const a = window.__SS__!; a.camera.follow(); await a.step(2); await a.screenshotReady(); });
    const collapseStatic = await page.evaluate(() => window.__SS__!.perf());
    const collapse = await record('true', 6_000);
    const proof = { renderer, tier, seed: 2, beatTicks: await page.evaluate(() => window.__SS__!.perf().l4), counts, firingSoldiers, warAwakeProps: warStatic.awakeProps, collapseAwakeProps: collapseStatic.awakeProps, warDrawCalls: warStatic.drawCalls, warTriangles: warStatic.triangles, collapseDrawCalls: collapseStatic.drawCalls, collapseTriangles: collapseStatic.triangles,
      warP50: percentile(war, .5), warP95: percentile(war, .95), warMax: Math.max(...war), turnMaxMs: Math.max(...turn), tankMaxMs: Math.max(...tank), breakMaxMs: Math.max(...breakFrames), collapseP50: percentile(collapse, .5), collapseP95: percentile(collapse, .95),
      simP95: percentile(warCpu.filter(c => c.ticks > 0).map(c => c.sim), .95), simFrameP95: percentile(warCpu.map(c => c.simFrame), .95), updateP95: percentile(warCpu.map(c => c.update), .95), renderP95: percentile(warCpu.map(c => c.render), .95), lineBroke: await page.evaluate(() => window.__SS__!.missions.state()!.l4!.lineBreakAt > 0) };
    writeFileSync(`${dir}/l4-${tier}.json`, JSON.stringify({ ...proof, coldBuilds: process.env.L4_TIMING_KEYS === '1' ? await page.evaluate(() => (window as unknown as { l4Builds: unknown[] }).l4Builds) : [], phaseCpu: process.env.L4_TIMING_KEYS === '1' ? await page.evaluate(() => (window as unknown as { l4Phases: unknown[] }).l4Phases) : [], slowCalls: process.env.L4_TIMING_KEYS === '1' ? await page.evaluate(() => (window as unknown as { l4Timing: unknown[] }).l4Timing) : [], warProfile: warStatic.profile, collapseProfile: collapseStatic.profile, collapseAssets: collapseStatic.profileAssets, war, turn, tank, breakFrames, collapse }, null, 2));
    console.log(JSON.stringify(proof));
    if (profiler) writeFileSync(`${dir}/l4-${tier}-profile.json`, JSON.stringify({ ...await profiler.send('Profiler.stop'), profileStartedAt, phases: await page.evaluate(() => (window as unknown as { l4Phases: unknown[] }).l4Phases) }));
    // The approved collapse: the first nest Alpha is in (84 s; l4-po-round: three Alphas in, from 84 s high, 92 s low), soldiers have died but the survivors still fight (at least half firing within the 8 s window; fallen-back posts can be out of range).
    expect(counts.turnS).toBeGreaterThanOrEqual(84); expect(counts.alphasArrived).toBeGreaterThanOrEqual(3);
    expect(counts.soldiers).toBeLessThan(counts.soldiersAtTurn); expect(counts.soldiers).toBeGreaterThanOrEqual(tier === 'high' ? 6 : 3);
    expect(counts.civilians).toBeGreaterThanOrEqual(tier === 'high' ? 40 : 20); expect(counts.infected).toBeGreaterThanOrEqual(tier === 'high' ? 80 : 40);
    expect(firingSoldiers).toBeGreaterThanOrEqual(Math.ceil(counts.soldiers * .5));
    expect(proof.lineBroke).toBe(true);
    // E18's sim budget measures one fixed step; low rAFs can advance several ticks.
    // Retain the total per-frame CPU cost separately, while frame/hitch bounds stay unchanged.
    expect(proof.simP95).toBeLessThanOrEqual(tier === 'high' ? 4 : 6);
    for (const [draws, tris] of [[proof.warDrawCalls, proof.warTriangles], [proof.collapseDrawCalls, proof.collapseTriangles]]) { expect(draws).toBeLessThanOrEqual(tier === 'high' ? 600 : 300); expect(tris).toBeLessThanOrEqual(tier === 'high' ? 1_500_000 : 500_000); }
    for (const awake of [proof.warAwakeProps, proof.collapseAwakeProps]) expect(awake).toBeLessThanOrEqual(tier === 'high' ? 150 : 60);
    // E18 frame targets: desktop high p95 within the 60 fps budget (14 ms incl. headroom); phone low >= 30 fps p50 at 4x CPU throttle.
    if (process.env.PHONE_PERF === '1' && tier === 'low') for (const p95 of [proof.warP95, proof.collapseP95]) expect(p95).toBeLessThanOrEqual(33.3);
    if (tier === 'high') { expect(proof.warP95).toBeLessThanOrEqual(14); expect(proof.collapseP95).toBeLessThanOrEqual(14); }
    else { expect(proof.warP50).toBeLessThanOrEqual(1000 / 30); expect(proof.collapseP50).toBeLessThanOrEqual(1000 / 30); }
    // E22-AC20 requires a literal 50 ms at every transition on both tiers.
    for (const max of [proof.turnMaxMs, proof.tankMaxMs, proof.breakMaxMs]) expect(max).toBeLessThanOrEqual(50);
  });
});
