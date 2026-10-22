/** Production assault, ordinary weapon inputs only. No spawned bodies or HP edits. */
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { SceneSession, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';

const out = process.env.L10_OUT ?? 'test-results/fixes-13h-l10/probe';
mkdirSync(out, { recursive: true });
const tier: 'low' | 'high' = process.env.L10_TIER === 'high' ? 'high' : 'low';
const timing = process.argv.includes('--timing');
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
  const result = await session.page.evaluate(async ({ tier }) => {
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
    for (let tick = 0; tick < 5400; tick += 6) {
      const p = g.world.entities.get(1)!, threats = g.world.infected!.active.filter(e => e.health.current > 0 && !e.infected?.pursuit && !e.hidden && !e.infected?.hidden);
      threats.sort((x, y) => Math.hypot(x.transform.x - p.transform.x, x.transform.z - p.transform.z) - Math.hypot(y.transform.x - p.transform.x, y.transform.z - p.transform.z));
      const target = threats[0], rack = p.weapons!.RIGHT.rack, index = rack.findIndex(e => e.id === 'weapon.rocket-launcher');
      if (index < 0) throw Error('Finale checkpoint lacks its rocket launcher');
      if (target) {
        const dx = target.transform.x - p.transform.x, dz = target.transform.z - p.transform.z, distance = Math.hypot(dx, dz) || 1;
        const input = { selectedSlot: { side: 'RIGHT' as const, index }, aimSource: 'keyboard' as const, aim: { x: dx / distance, z: dz / distance }, aimPoint: { x: target.transform.x, z: target.transform.z }, right: { down: false, held: true, up: false } };
        a.input.set(input); inputs.push({ tick: a.tick(), ...input });
      } else a.input.clear();
      await a.step(6);
    }
    off(); a.input.clear(); await a.step(150);
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
      if (m.name.startsWith('corpses:') && m.count) pages.push({ name: m.name, instances: m.count, vertices: m.geometry.getAttribute('position').count, triangles: (m.geometry.index?.count ?? m.geometry.getAttribute('position').count) / 3, source: m.geometry.userData });
    });
    return { kills, inputs, bodies: bodies.map(e => ({ id: e.id, archetype: e.archetype, variant: e.infected?.variant, model: e.infected?.model, appearance: e.appearance, at: e.transform })), sources, pages, tick: a.tick(), perf: a.perf() };
  }, { tier });
  assert.ok(result.kills.length > 0, 'the assault must produce real combat kill events');
  assert.equal(result.bodies.length, result.kills.length, 'every real kill must remain a permanent body');
  const captures = [];
  for (const zoom of [.5, 1, 1.5]) {
    const state = await session.page.evaluate(async zoom => {
      const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game, rig = g.view.view, hero = g.world.entities.get(1)!.transform;
      a.inspect.enable(false);
      rig.inspectionPose = null; rig.reset(hero); rig.zoom(Math.log(zoom / rig.getState().targetZoom), true); rig.update(hero, 0);
      await a.step(1); await a.screenshotReady();
      return { backend: a.perf().backend, quality: a.getState().render.quality, camera: a.getState().render.camera, corpses: a.query({}).filter(e => e.corpse).length };
    }, zoom);
    assert.equal(state.backend, session.options.backend === 'webgl2' ? 'webgl' : 'webgpu');
    assert.equal(state.quality, tier); assert.ok(Math.abs(state.camera.zoom - zoom) < .001);
    assert.ok(Math.abs(Math.hypot(...state.camera.position.map((p, i) => p - state.camera.target[i])) - state.camera.radius) < .01, 'actual camera must match the requested zoom');
    const samples = [];
    if (timing && zoom === 1) for (let repeat = 0; repeat < 3; repeat++) samples.push(await session.page.evaluate(async () => {
      const a = window.__SS__!, frames: number[] = [];
      a.inspect.enable(true, { courier: 'unchanged' }); a.inspect.timeScale(0);
      const start = performance.now(); let previous = 0;
      while (performance.now() - start < 6000) {
        const now = await new Promise<number>(resolve => requestAnimationFrame(resolve));
        if (previous && now - start > 1000) frames.push(now - previous);
        previous = now;
      }
      frames.sort((a, b) => a - b);
      return { frames: frames.length, p95: frames[Math.ceil(frames.length * .95) - 1], max: frames.at(-1) };
    }));
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
    await session.page.screenshot({ path: `${out}/z${zoom}.jpg`, type: 'jpeg', quality: 90 });
    captures.push({ zoom, state, samples });
  }
  writeFileSync(`${out}/evidence.json`, JSON.stringify({ ...result, captures, errors: session.errors }, null, 2));
  assert.deepEqual(session.errors, []);
  console.log(JSON.stringify({ tier, backend: session.options.backend, kills: result.kills.length, bodies: result.bodies.length, captures, errors: session.errors }));
} finally { await session.close(); stopServer(); }
