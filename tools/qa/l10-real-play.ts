/** Production assault, ordinary weapon inputs only. No spawned bodies or HP edits. */
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { SceneSession, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';

const out = process.env.L10_OUT ?? 'test-results/fixes-13h-l10/probe';
mkdirSync(out, { recursive: true });
const tier: 'low' | 'high' = process.env.L10_TIER === 'high' ? 'high' : 'low';
const timing = process.argv.includes('--timing');
const realTime = process.argv.includes('--real-time');
const session = new SceneSession({ backend: process.env.L10_BACKEND === 'webgpu' ? 'webgpu' : 'webgl2', tier, nativeFrameTiming: timing });
try {
  await session.open();
  await session.page.evaluate('globalThis.__name = fn => fn');
  if (process.env.L10_PROFILE === '1') await session.page.evaluate(() => {
    const g = (window.__SCENE__ as unknown as { game: Game }).game;
    const prior = g.view.renderer.debug.onNodeBuilderCreated;
    g.view.renderer.debug.onNodeBuilderCreated = (builder, object) => {
      prior?.(builder, object);
      if ((object as { material?: { name: string } }).material?.name === 'pal_asphalt') (window as unknown as { l10Shader: unknown }).l10Shader = builder;
    };
  });
  const result = await session.page.evaluate(async ({ tier, realTime }) => {
    const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
    a.settings.set({ quality: tier, cameraShake: false, cheapDof: false });
    await a.loadLevel('L10', { seed: 32, checkpoint: 'cure-disperse-ready' });
    a.pause(); a.cheats.god(true); a.teleport(1, { x: 4002, z: -27 });
    a.input.set({ interact: true }); await a.step(1); a.input.clear();
    const kills: unknown[] = [], inputs: unknown[] = [];
    const off = g.world.events.on('combat.kill', event => {
      if (event.type !== 'combat.kill') return;
      const e = g.world.entities.get(event.targetId)!;
      kills.push({ ...event, archetype: e.archetype, variant: e.infected?.variant, model: e.infected?.model, appearance: e.appearance });
    });
    const attack = () => {
      const p = g.world.entities.get(1)!, threats = g.world.infected!.active.filter(e => e.health.current > 0 && !e.infected?.pursuit && !e.hidden && !e.infected?.hidden);
      threats.sort((x, y) => Math.hypot(x.transform.x - p.transform.x, x.transform.z - p.transform.z) - Math.hypot(y.transform.x - p.transform.x, y.transform.z - p.transform.z));
      const target = threats[0], rack = p.weapons!.RIGHT.rack, index = rack.findIndex(e => e.id === 'weapon.rocket-launcher');
      if (index < 0) throw Error('Finale checkpoint lacks its rocket launcher');
      if (target) {
        const dx = target.transform.x - p.transform.x, dz = target.transform.z - p.transform.z, distance = Math.hypot(dx, dz) || 1;
        const input = { selectedSlot: { side: 'RIGHT' as const, index }, aimSource: 'keyboard' as const, aim: { x: dx / distance, z: dz / distance }, aimPoint: { x: target.transform.x, z: target.transform.z }, right: { down: false, held: true, up: false } };
        inputs.push({ tick: a.tick(), ...input }); return input;
      }
      return null;
    };
    let nativePerformance: { frames: number; p95: number; max: number; durationMs: number; fromTick: number; toTick: number } | null = null;
    if (realTime) {
      // Drive ordinary inputs through the production feed at 60 simulation
      // ticks/s, rather than accelerating the assault with the stepping API.
      const fromTick = a.tick(), stopTick = fromTick + 5400 + 150;
      const neutral = structuredClone(g.world.inputFrame), frames: number[] = [];
      let current: ReturnType<typeof attack> = null, running = true;
      const start = performance.now(); let previous = start;
      const sample = (now: number) => {
        if (now > start) frames.push(now - Math.max(previous, start)); previous = now;
        if (running) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
      const update = g.world.update;
      const completed = new Promise<void>(resolve => {
        g.world.update = function () {
          update.call(this);
          if (this.tick >= stopTick) { g.clock.pause(); running = false; resolve(); }
        };
      });
      g.input.feed = { scheme: 'keyboard', next: () => {
        if (g.world.tick < fromTick + 5400 && (g.world.tick - fromTick) % 6 === 0) current = attack();
        if (g.world.tick >= fromTick + 5400) current = null;
        return { ...structuredClone(neutral), ...(current ? structuredClone(current) : {}) };
      } };
      try {
        g.clock.setTimeScale(1); g.clock.resume(); await completed;
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      } finally { running = false; g.clock.pause(); g.input.feed = null; g.world.update = update; }
      frames.sort((x, y) => x - y);
      nativePerformance = { frames: frames.length, p95: frames[Math.ceil(frames.length * .95) - 1], max: frames.at(-1)!, durationMs: performance.now() - start, fromTick, toTick: a.tick() };
    } else {
      for (let tick = 0; tick < 5400; tick += 6) {
        const input = attack(); if (input) a.input.set(input); else a.input.clear();
        await a.step(6);
      }
      a.input.clear(); await a.step(150);
    }
    off(); a.input.clear();
    // Paused stepping drives simulation, while VFX have their own render clock.
    // Let transient blast smoke/gibs expire so they cannot obscure the bodies.
    for (let seconds = 0; seconds < 35; seconds++) a.vfx.stepRender(1);
    await a.screenshotReady();
    const bodies = [...g.world.entities.iterate()].filter(e => e.corpse);
    const crowd = (g.view as unknown as { crowd: { corpseGeometry: Map<string, import('three').BufferGeometry> } }).crowd;
    const sources = [...crowd.corpseGeometry].map(([key, geometry]) => ({ key, source: geometry.userData, vertices: geometry.getAttribute('position').count }));
    const pages: unknown[] = [];
    g.view.scene.traverse(o => {
      const m = o as import('three').InstancedMesh;
      if (m.name.startsWith('corpses:') && m.count) pages.push({ name: m.name, order: m.renderOrder, instances: m.count, vertices: m.geometry.getAttribute('position').count, triangles: (m.geometry.index?.count ?? m.geometry.getAttribute('position').count) / 3, source: m.geometry.userData, precomputedNormals: m.geometry.hasAttribute('_placementNormal0') });
    });
    return { kills, inputs, bodies: bodies.map(e => ({ id: e.id, archetype: e.archetype, variant: e.infected?.variant, model: e.infected?.model, appearance: e.appearance, at: e.transform })), sources, pages, tick: a.tick(), nativePerformance, perf: a.perf() };
  }, { tier, realTime });
  if (process.env.L10_CORPSE_ORDER !== undefined) await session.page.evaluate(order => {
    const g = (window.__SCENE__ as unknown as { game: Game }).game;
    g.view.scene.traverse(object => { if (object.name.startsWith('corpses:')) object.renderOrder = order; });
  }, Number(process.env.L10_CORPSE_ORDER));
  assert.ok(result.kills.length > 0, 'the assault must produce real combat kill events');
  assert.equal(result.bodies.length, result.kills.length, 'every real kill must remain a permanent body');
  const captures = [];
  for (const zoom of [.5, 1, 1.5]) {
    const state = await session.page.evaluate(async zoom => {
      const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game, rig = g.view.view, hero = g.world.entities.get(1)!.transform;
      const light = (g.view as unknown as { lighting: { sun: { visible: boolean }; spot: { visible: boolean }; heroLight: string | null } }).lighting;
      a.inspect.enable(false);
      rig.inspectionPose = null; rig.reset(hero); rig.zoom(Math.log(zoom / rig.getState().targetZoom), true); rig.update(hero, 0);
      await a.step(1); await a.screenshotReady();
      return { backend: a.perf().backend, quality: a.getState().render.quality, camera: a.getState().render.camera, corpses: a.query({}).filter(e => e.corpse).length, tick: a.tick(), lighting: { sun: light.sun.visible, spot: light.spot.visible, heroLight: light.heroLight } };
    }, zoom);
    assert.equal(state.backend, session.options.backend === 'webgl2' ? 'webgl' : 'webgpu');
    assert.equal(state.quality, tier); assert.ok(Math.abs(state.camera.zoom - zoom) < .001);
    assert.ok(Math.abs(Math.hypot(...state.camera.position.map((p, i) => p - state.camera.target[i])) - state.camera.radius) < .01, 'actual camera must match the requested zoom');
    const samples = [];
    const savedClock = timing && zoom === 1 ? await session.page.evaluate(async () => {
      const g = (window.__SCENE__ as unknown as { game: Game }).game;
      const saved = { paused: g.clock.paused, timeScale: g.clock.timeScale };
      await g.view.renderer.finishWarmUp();
      // Keep normal gameplay presentation and its camera, with a fixed world.
      // Inspection adds its own pose, panel, picking and statistics updates.
      g.clock.setTimeScale(0); g.clock.resume();
      return saved;
    }) : null;
    if (timing && zoom === 1) for (let repeat = 0; repeat < 3; repeat++) samples.push(await session.page.evaluate(async () => {
      const a = window.__SS__!, frames: number[] = [], tickBefore = a.tick();
      const start = performance.now(); let previous = 0;
      while (performance.now() - start < 6000) {
        const now = await new Promise<number>(resolve => requestAnimationFrame(resolve));
        if (previous && now - start > 1000) frames.push(now - previous);
        previous = now;
      }
      frames.sort((a, b) => a - b);
      return { frames: frames.length, p95: frames[Math.ceil(frames.length * .95) - 1], max: frames.at(-1), tickBefore, tickAfter: a.tick(), camera: a.getState().render.camera };
    }));
    for (const sample of samples) {
      assert.equal(sample.tickBefore, state.tick); assert.equal(sample.tickAfter, state.tick);
      assert.ok(Math.abs(sample.camera.zoom - zoom) < .001);
      assert.ok(Math.hypot(...sample.camera.position.map((p, i) => p - state.camera.position[i])) < .01, 'cadence samples must retain the captured gameplay camera');
    }
    if (timing && zoom === 1 && process.env.L10_PROFILE === '1') {
      // Diagnose the same settled view after timing, keeping profiler overhead
      // outside the cadence samples used for the before/after comparison.
      const cdp = await session.page.context().newCDPSession(session.page);
      await cdp.send('Performance.enable');
      const { metrics } = await cdp.send('Performance.getMetrics');
      const performanceNavigationStartMs = metrics.find(m => m.name === 'NavigationStart')!.value * 1000;
      await cdp.send('Profiler.enable'); await cdp.send('Profiler.start');
      await session.page.waitForTimeout(6000);
      const { profile } = await cdp.send('Profiler.stop'); await cdp.detach();
      writeFileSync(`${out}/settled.cpuprofile`, JSON.stringify({ ...profile, performanceNavigationStartMs }));
      writeFileSync(`${out}/settled-perf.json`, JSON.stringify(await session.page.evaluate(() => window.__SS__!.perf()), null, 2));
      const shader = await session.page.evaluate(() => {
        const builder = (window as unknown as { l10Shader?: { vertexShader: string; fragmentShader: string } }).l10Shader;
        return builder ? { vertex: builder.vertexShader, fragment: builder.fragmentShader } : null;
      });
      writeFileSync(`${out}/settled-shader.json`, JSON.stringify(shader, null, 2));
    }
    if (timing && zoom === 1 && session.options.backend === 'webgpu' && process.env.L10_GPU_DIAGNOSTICS === '1') {
      // Supplemental GPU timings follow all cadence/CPU samples, so query
      // readback cannot alter the frame percentiles used for acceptance.
      const gpu = await session.page.evaluate(async () => {
        const g = (window.__SCENE__ as unknown as { game: Game }).game;
        const backend = g.view.renderer.backend as unknown as { trackTimestamp: boolean; device: { features: { has(name: string): boolean } }; resolveTimestampsAsync(type: string): Promise<number | undefined> };
        if (!backend.device.features.has('timestamp-query')) return { supported: false, samples: [] };
        const was = backend.trackTimestamp, samples: number[] = []; backend.trackTimestamp = true;
        try {
          for (let i = 0; i < 90; i++) {
            await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
            const ms = await backend.resolveTimestampsAsync('render');
            if (ms !== undefined && i >= 10) samples.push(ms);
          }
        } finally { backend.trackTimestamp = was; }
        samples.sort((a, b) => a - b);
        return { supported: true, samples, median: samples[Math.floor(samples.length / 2)], p95: samples[Math.ceil(samples.length * .95) - 1] };
      });
      writeFileSync(`${out}/settled-gpu.json`, JSON.stringify(gpu, null, 2));
    }
    if (savedClock) await session.page.evaluate(async saved => {
      const g = (window.__SCENE__ as unknown as { game: Game }).game;
      g.clock.setTimeScale(saved.timeScale); if (saved.paused) g.clock.pause(); else g.clock.resume();
      await window.__SS__!.screenshotReady();
    }, savedClock);
    await session.page.screenshot({ path: `${out}/z${zoom}.jpg`, type: 'jpeg', quality: 90 });
    captures.push({ zoom, state, samples });
  }
  writeFileSync(`${out}/evidence.json`, JSON.stringify({ ...result, renderOrderOverride: process.env.L10_CORPSE_ORDER, captures, errors: session.errors }, null, 2));
  assert.deepEqual(session.errors, []);
  console.log(JSON.stringify({ tier, backend: session.options.backend, kills: result.kills.length, bodies: result.bodies.length, captures, errors: session.errors }));
} finally { await session.close(); stopServer(); }
