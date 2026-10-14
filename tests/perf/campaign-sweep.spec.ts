import { mkdirSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { devices } from '@playwright/test';
import { test, expect, boot } from '../e2e/fixtures';
import type { Game } from '../../src/Game';

// Run after a fresh build, directly under quiet-run (no outer e2e-lock).
// Desktop viewport on both tiers isolates quality cost from phone CPU emulation.
const phone = process.env.SWEEP_PHONE === '1';
const phase = process.env.SWEEP_PHASE ?? 'after';
const dir = phone ? `docs/reports/phone-perf/${phase}` : `docs/reports/perf-sweep/${phase}`;
if (phone) test.use({ ...devices['Pixel 7'], viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, defaultBrowserType: 'chromium' });
test.use({ channel: 'chrome', headless: true, launchOptions: { args: [
  '--use-angle=metal', '--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist',
  '--disable-frame-rate-limit', '--disable-gpu-vsync', '--enable-precise-memory-info',
] } });

for (const backend of (phone ? ['webgl'] as const : ['webgl', 'webgpu'] as const)) for (const tier of (phone ? ['low'] as const : ['high', 'low'] as const))
  for (let n = 1; n <= 10; n++) test(`campaign sweep L${n} ${tier} ${backend} @perf @E18`, async ({ page, context }) => {
    test.setTimeout(600_000);
    const level = `L${n}`;
    if (phone) { const throttle = await context.newCDPSession(page); await throttle.send('Emulation.setCPUThrottlingRate', { rate: 4 }); }
    await boot(page, `/?test=1&scenelab=1&quality=${tier}&audio=muted&dpr=${phone ? 1.5 : 1}${!phone || process.env.SWEEP_PROFILE || process.env.SWEEP_RENDER_PROFILE === '1' ? '&profile' : ''}${backend === 'webgl' ? '&renderer=webgl' : ''}`);
    const spots = await page.evaluate(async ({ level, scenario, phone }) => {
      const a = window.__SS__!;
      if (scenario) await a.loadScenario(scenario, { seed: 2 });
      else await a.loadLevel(level, { seed: 2 });
      const game = (window.__SCENE__ as unknown as { game: Game }).game;
      if (phone && game.world.chunks) {
        // A photo camera can be far from the APC route. Align streamed physics/nav
        // with that camera, matching the visible district; real APC travel is covered separately.
        const chunks = game.world.chunks, update = chunks.update.bind(chunks);
        chunks.update = (focus, velocity) => update((window as unknown as { phoneStressFocus?: [number, number] }).phoneStressFocus ?? focus, velocity);
      }
      a.pause(); if (game.world.missions) a.missions.begin();
      a.cheats.god(true); a.settings.set({ slowMotion: false });
      // Access Scene Lab's game handle without its optional full-skeleton probes.
      a.debug.figureJoints(false);
      const player = a.query({}).find(e => e.survivor)!;
      const photos = [...game.view.labProbes().districts!.spots].map(([id, pose]) => ({ id, position: pose.target }));
      const mission = game.world.missions;
      const checkpoints = level === 'L10' ? (mission?.def.checkpoints ?? []).flatMap(id => {
        const at = mission!.def.anchors[id];
        return at ? [{ id: `checkpoint/${id}`, position: [at.x, 0, at.z] as [number, number, number] }] : [];
      }) : [];
      const selected = [...photos, ...checkpoints];
      return [{ id: 'start', position: [player.transform.x, player.transform.y, player.transform.z] }, ...selected]
        .filter((s, i, all) => all.findIndex(o => o.position[0] === s.position[0] && o.position[2] === s.position[2]) === i);
    }, { level, scenario: process.env.SWEEP_SCENARIO, phone });
    const cdp = await context.newCDPSession(page);
    const rows = [];
    for (const spot of spots.filter(s => !process.env.SWEEP_SPOT || s.id === process.env.SWEEP_SPOT)) {
      await page.evaluate(async ({ spot, phone }) => {
        const a = window.__SS__!;
        if (phone) (window as unknown as { phoneStressFocus: [number, number] }).phoneStressFocus = [spot.position[0], spot.position[2]];
        a.teleport('player', { x: spot.position[0], z: spot.position[2] });
        // Instant normal game framing avoids measuring an artificial cross-city camera flight.
        a.camera.cinematic({ position: [spot.position[0] + 10.868, spot.position[1] + 11.168, spot.position[2] + 10.868], target: spot.position as [number, number, number] }, true);
        if (phone) {
          const game = (window.__SCENE__ as unknown as { game: Game }).game;
          game.world.chunks?.update();
          const ai = game.world.infected!;
          const points: { x: number; z: number }[] = [];
          for (let z = -18; z <= 18; z += 1.2) for (let x = -18; x <= 18; x += 1.2) {
            const p = { x: spot.position[0] + x, z: spot.position[2] + z };
            if (ai.nav.clear(p.x, p.z, 1.4)) points.push(p);
          }
          points.sort((a,b) => Math.hypot(a.x - spot.position[0], a.z - spot.position[2]) - Math.hypot(b.x - spot.position[0], b.z - spot.position[2]));
          if (points.length < Math.min(100, ai.director.cap)) throw new Error(`Phone stress lacks legal crowd positions: ${points.length}/${ai.director.cap}`);
          let index = 0;
          for (const e of a.query({}).filter(e => e.infected && e.health.current > 0 && !e.hidden)) a.teleport(e.id, points[index++ % points.length]);
          const populate = () => {
            const target = Math.min(100, ai.director.cap);
            while (ai.director.count + 1 <= target && ai.pool.length > 0) ai.spawn('infected.runner', points[index++ % points.length], { state: 'chase' });
            // Flocks use quarter slots; retain authored flocks and fill the remaining fraction.
            const remainder = target - ai.director.count;
            if (remainder > 0 && remainder < 1 && ai.pool.length > 0) ai.spawn('infected.crow', points[index++ % points.length], { birds: Math.round(remainder * 4) });
          };
          (window as unknown as { phoneStressPopulate(): void }).phoneStressPopulate = populate;
          populate();
        }
        await a.screenshotReady(); a.resume();
        const start = performance.now(); while (performance.now() - start < 2000) await new Promise(r => requestAnimationFrame(r));
        a.pause();
      }, { spot, phone });
      await cdp.send('HeapProfiler.collectGarbage');
      const profiling = process.env.SWEEP_PROFILE === 'all' || process.env.SWEEP_PROFILE === `${level}-${tier}-${backend}`;
      const tracing = profiling && process.env.SWEEP_TRACE === '1' && (!process.env.SWEEP_TRACE_SPOT || process.env.SWEEP_TRACE_SPOT === spot.id);
      const traceDone = tracing ? new Promise<string>((resolve, reject) => cdp.once('Tracing.tracingComplete', data => {
        if (data.stream) resolve(data.stream); else reject(new Error('Browser trace stream missing'));
      })) : null;
      if (tracing) await cdp.send('Tracing.start', { categories: 'devtools.timeline,v8,gpu,cc', transferMode: 'ReturnAsStream' });
      if (profiling) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start'); }
      const row = await page.evaluate(async ({ profiling, glProfile, phone }) => {
        const a = window.__SS__!, frames: number[] = [], sims: number[] = [], updates: number[] = [], renders: number[] = [];
        const hitches: unknown[] = [], costs: Record<string, number>[] = [];
        const game = (window.__SCENE__ as unknown as { game: Game }).game;
        const pipelines: unknown[] = [];
        const glCalls: unknown[] = [], glCosts: Record<string, { calls: number; ms: number; maxMs: number }> = {}, glOriginals = new Map<string, (...args: unknown[]) => unknown>();
        const gl = (game.view.renderer.backend as unknown as { gl?: Record<string, (...args: unknown[]) => unknown> }).gl;
        if (glProfile && gl) for (const key of ['bufferSubData', 'texSubImage2D', 'drawElementsInstanced', 'drawArraysInstanced', 'drawElements', 'getParameter', 'getBufferSubData', 'clientWaitSync', 'readPixels', 'checkFramebufferStatus', 'finish', 'flush', 'getProgramParameter', 'getUniformLocation', 'getActiveUniform', 'getShaderParameter', 'compileShader', 'linkProgram']) {
          const original = gl[key]; if (typeof original !== 'function') continue;
          glOriginals.set(key, original);
          const cost = glCosts[key] = { calls: 0, ms: 0, maxMs: 0 };
          gl[key] = function (...args) {
            const start = performance.now(), result = original.apply(gl, args), ms = performance.now() - start;
            cost.calls++; cost.ms += ms; cost.maxMs = Math.max(cost.maxMs, ms);
            if (ms > 3) glCalls.push({ method: key, ms, tick: a.tick(), bytes: (args[key === 'bufferSubData' ? 2 : 8] as { byteLength?: number } | undefined)?.byteLength });
            return result;
          };
        }
        const renderBackend = game.view.renderer.backend as unknown as { createRenderPipeline(...args: unknown[]): unknown };
        const createPipeline = renderBackend.createRenderPipeline;
        if (profiling) renderBackend.createRenderPipeline = function (...args) {
          const start = performance.now(), result = createPipeline.apply(this, args);
          const object = args[0] as { material: { name: string }; object: { name: string } };
          pipelines.push({ ms: performance.now() - start, material: object.material.name, object: object.object.name, tick: a.tick() });
          return result;
        };
        if (profiling) a.debug.cpuProfile();
        let previous = 0, draws = 0, triangles = 0, infected = 0, weightedInfected = 0, stressCap = 0, lastPopulation = 0;
        a.resume(); const start = performance.now();
        while (performance.now() - start < 5000) {
          const now = await new Promise<number>(r => requestAnimationFrame(r)), p = a.perf();
          if (phone && now - lastPopulation >= 100) { (window as unknown as { phoneStressPopulate(): void }).phoneStressPopulate(); lastPopulation = now; }
          if (previous) {
            const ms = Math.round((now - previous) * 1e9) / 1e9; frames.push(ms);
            if (ms > 30) hitches.push({ ms, sim: p.simMs, update: p.updateCpuMs, render: p.renderCpuMs, nodeBuilds: p.nodeBuilds });
          }
          if (phone) { weightedInfected = Math.max(weightedInfected, game.world.infected!.director.count); stressCap = Math.max(stressCap, Math.min(100, game.world.infected!.director.cap)); }
          previous = now; if (p.simTickMs > 0) sims.push(p.simTickMs);
          updates.push(p.updateCpuMs); renders.push(p.renderCpuMs);
          if (profiling) costs.push(a.debug.cpuProfile());
          draws = Math.max(draws, p.drawCalls); triangles = Math.max(triangles, p.triangles); infected = Math.max(infected, p.infected?.count ?? 0);
        }
        a.pause(); if (profiling) renderBackend.createRenderPipeline = createPipeline;
        if (gl) for (const [key, original] of glOriginals) gl[key] = original;
        const q = (v: number[], p: number) => [...v].sort((a,b) => a-b)[Math.ceil(v.length * p) - 1] ?? 0;
        const glContext = document.querySelector('canvas')!.getContext('webgl2'), gpuExtension = glContext?.getExtension('WEBGL_debug_renderer_info');
        const civilian = (game.view as unknown as { npcs?: { civilians: { visibility: { renderPixels(x: number, y: number, z: number, height: number): number }; batches: { lod: string; poses: { states: Map<number, { clip: string }> }; probe: { figures: { id: number }[] } }[] } } }).npcs?.civilians;
        const posePolicy = profiling && civilian ? civilian.batches.flatMap(batch => batch.probe.figures.map(figure => {
          const e = game.world.entities.get(figure.id)!, player = game.world.entities.get(1)!;
          return { id: e.id, archetype: e.archetype, state: e.infected?.state ?? e.civilian?.state, lod: batch.lod, baked: batch.poses.states.get(e.id)?.clip.endsWith(':baked'), pixels: civilian.visibility.renderPixels(e.transform.x, e.transform.y, e.transform.z, 1.8), distance: Math.hypot(e.transform.x - player.transform.x, e.transform.z - player.transform.z) };
        })) : undefined;
        return { posePolicy, gpu: gpuExtension ? String(glContext!.getParameter(gpuExtension.UNMASKED_RENDERER_WEBGL)) : null, touchPoints: navigator.maxTouchPoints, backend: a.perf().backend, quality: a.perf().quality.tier, scenario: a.getState().scenario,
          p50: q(frames,.5), p95: q(frames,.95), p99: q(frames,.99), hitch: Math.max(...frames),
          simMs: q(sims,.95), updateMs: q(updates,.95), renderMs: q(renders,.95), drawCalls: draws, triangles, infected, weightedInfected, stressCap,
          sceneNodes: profiling ? game.view.scene.children.map(root => {
            let nodes = 0, meshes = 0; root.traverseVisible(node => { nodes++; if ((node as unknown as { isMesh?: boolean }).isMesh) meshes++; });
            const field = Object.entries(game.view).find(([, value]) => value === root)?.[0];
            return { name: root.name || field || root.type, nodes, meshes, branches: root.children.map(child => {
              let nodes = 0, meshes = 0; child.traverseVisible(node => { nodes++; if ((node as unknown as { isMesh?: boolean }).isMesh) meshes++; });
              return { name: child.name || child.type, nodes, meshes };
            }).sort((a,b) => b.meshes - a.meshes).slice(0, 20) };
          }) : undefined,
          resources: profiling ? performance.getEntriesByType('resource').filter(entry => entry.startTime >= start).map(entry => ({ name: entry.name.replace(location.origin, ''), ms: entry.startTime - start, duration: entry.duration, bytes: (entry as PerformanceResourceTiming).decodedBodySize })) : undefined,
          frames, hitches, pipelines, glCalls, glCosts, costs: costs.length ? Object.fromEntries(Object.keys(costs[0]).map(key => [key, q(costs.map(c => c[key]), .95)])) : null, counters: a.perf() };
      }, { profiling, glProfile: process.env.SWEEP_GL_PROFILE === '1', phone });
      if (profiling) {
        mkdirSync(dir, { recursive: true });
        writeFileSync(`${dir}/${level}-${tier}-${backend}-${rows.length}.cpuprofile`, JSON.stringify((await cdp.send('Profiler.stop')).profile));
      }
      if (traceDone) {
        await cdp.send('Tracing.end');
        const handle = await traceDone;
        let trace = '', eof = false;
        while (!eof) { const chunk = await cdp.send('IO.read', { handle }); trace += chunk.data; eof = chunk.eof; }
        await cdp.send('IO.close', { handle });
        writeFileSync(`${dir}/${level}-${tier}-${backend}-${rows.length}.trace.json.gz`, gzipSync(trace));
      }
      await cdp.send('HeapProfiler.collectGarbage');
      const heapMB = (await cdp.send('Runtime.getHeapUsage')).usedSize / 1e6;
      rows.push({ spot, ...row, heapMB });
      mkdirSync(dir, { recursive: true });
      writeFileSync(`${dir}/${level}-${tier}-${backend}.json`, JSON.stringify({ level, tier, backend, seed: 2, viewport: phone ? { width: 390, height: 844 } : { width: 1600, height: 900 }, cpuThrottle: phone ? 4 : 1, rows }));
      console.log(JSON.stringify({ level, tier, backend, spot: spot.id, p95: row.p95, hitch: row.hitch, simMs: row.simMs, drawCalls: row.drawCalls, triangles: row.triangles, heapMB }));
      expect.soft(row.backend).toBe(backend); expect.soft(row.quality).toBe(tier);
      expect.soft(row.drawCalls).toBeGreaterThan(0);
      if (!process.env.SWEEP_SCENARIO) expect.soft(row.scenario).toBe(level);
      if (phone) { expect.soft(row.gpu).toBeTruthy(); expect.soft(row.gpu).not.toMatch(/swiftshader|llvmpipe|software/i); expect.soft(row.touchPoints).toBeGreaterThan(0); }
      if (phone) expect.soft(row.weightedInfected, 'The phone stress window must reach its authored low-tier crowd cap').toBeGreaterThanOrEqual(row.stressCap);
      if (phase === 'after' || process.env.SWEEP_ASSERT_BUDGETS === '1') {
        expect.soft(row.p95).toBeLessThanOrEqual(tier === 'high' ? 16.7 : 33.3);
        // The original desktop sweep owns this 50 ms hitch gate. E18 phone acceptance is p95;
        // authored phone transition probes retain their separate hitch limits.
        if (!phone) expect.soft(row.hitch).toBeLessThanOrEqual(50);
        expect.soft(row.simMs).toBeLessThanOrEqual(tier === 'high' ? 4 : 6);
        expect.soft(row.drawCalls).toBeLessThanOrEqual(tier === 'high' ? 600 : 300);
        expect.soft(row.triangles).toBeLessThanOrEqual(tier === 'high' ? 1_500_000 : 500_000);
        expect.soft(heapMB).toBeLessThanOrEqual(tier === 'high' ? 400 : 250);
      }
    }
  });
