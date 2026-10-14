import { mkdirSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { test, expect, boot } from '../e2e/fixtures';
import type { Game } from '../../src/Game';

// Run after a fresh build, directly under quiet-run (no outer e2e-lock).
// Desktop viewport on both tiers isolates quality cost from phone CPU emulation.
const phase = process.env.SWEEP_PHASE ?? 'after';
const dir = `docs/reports/perf-sweep/${phase}`;
test.use({ channel: 'chrome', headless: true, launchOptions: { args: [
  '--use-angle=metal', '--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist',
  '--disable-frame-rate-limit', '--disable-gpu-vsync', '--enable-precise-memory-info',
] } });

for (const backend of ['webgl', 'webgpu'] as const) for (const tier of ['high', 'low'] as const)
  for (let n = 1; n <= 10; n++) test(`campaign sweep L${n} ${tier} ${backend} @perf @E18`, async ({ page, context }) => {
    test.setTimeout(600_000);
    const level = `L${n}`;
    await boot(page, `/?test=1&scenelab=1&quality=${tier}&audio=muted&dpr=1&profile${backend === 'webgl' ? '&renderer=webgl' : ''}`);
    const spots = await page.evaluate(async ({ level, scenario }) => {
      const a = window.__SS__!;
      if (scenario) await a.loadScenario(scenario, { seed: 2 });
      else await a.loadLevel(level, { seed: 2 });
      const game = (window.__SCENE__ as unknown as { game: Game }).game;
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
    }, { level, scenario: process.env.SWEEP_SCENARIO });
    const cdp = await context.newCDPSession(page);
    const rows = [];
    for (const spot of spots.filter(s => !process.env.SWEEP_SPOT || s.id === process.env.SWEEP_SPOT)) {
      await page.evaluate(async spot => {
        const a = window.__SS__!;
        a.teleport('player', { x: spot.position[0], z: spot.position[2] });
        // Instant normal game framing avoids measuring an artificial cross-city camera flight.
        a.camera.cinematic({ position: [spot.position[0] + 10.868, spot.position[1] + 11.168, spot.position[2] + 10.868], target: spot.position as [number, number, number] }, true);
        await a.screenshotReady(); a.resume();
        const start = performance.now(); while (performance.now() - start < 2000) await new Promise(r => requestAnimationFrame(r));
        a.pause();
      }, spot);
      await cdp.send('HeapProfiler.collectGarbage');
      const profiling = process.env.SWEEP_PROFILE === `${level}-${tier}-${backend}`;
      const tracing = profiling && process.env.SWEEP_TRACE === '1' && (!process.env.SWEEP_TRACE_SPOT || process.env.SWEEP_TRACE_SPOT === spot.id);
      const traceDone = tracing ? new Promise<string>((resolve, reject) => cdp.once('Tracing.tracingComplete', data => {
        if (data.stream) resolve(data.stream); else reject(new Error('Browser trace stream missing'));
      })) : null;
      if (tracing) await cdp.send('Tracing.start', { categories: 'devtools.timeline,v8,gpu,cc', transferMode: 'ReturnAsStream' });
      if (profiling) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start'); }
      const row = await page.evaluate(async ({ profiling, glProfile }) => {
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
        let previous = 0, draws = 0, triangles = 0, infected = 0;
        a.resume(); const start = performance.now();
        while (performance.now() - start < 5000) {
          const now = await new Promise<number>(r => requestAnimationFrame(r)), p = a.perf();
          if (previous) {
            const ms = Math.round((now - previous) * 1e9) / 1e9; frames.push(ms);
            if (ms > 30) hitches.push({ ms, sim: p.simMs, update: p.updateCpuMs, render: p.renderCpuMs, nodeBuilds: p.nodeBuilds });
          }
          previous = now; if (p.simTickMs > 0) sims.push(p.simTickMs);
          updates.push(p.updateCpuMs); renders.push(p.renderCpuMs);
          if (profiling) costs.push(a.debug.cpuProfile());
          draws = Math.max(draws, p.drawCalls); triangles = Math.max(triangles, p.triangles); infected = Math.max(infected, p.infected?.count ?? 0);
        }
        a.pause(); if (profiling) renderBackend.createRenderPipeline = createPipeline;
        if (gl) for (const [key, original] of glOriginals) gl[key] = original;
        const q = (v: number[], p: number) => [...v].sort((a,b) => a-b)[Math.ceil(v.length * p) - 1] ?? 0;
        return { backend: a.perf().backend, quality: a.perf().quality.tier, scenario: a.getState().scenario,
          p50: q(frames,.5), p95: q(frames,.95), p99: q(frames,.99), hitch: Math.max(...frames),
          simMs: q(sims,.95), updateMs: q(updates,.95), renderMs: q(renders,.95), drawCalls: draws, triangles, infected,
          frames, hitches, pipelines, glCalls, glCosts, costs: costs.length ? Object.fromEntries(Object.keys(costs[0]).map(key => [key, q(costs.map(c => c[key]), .95)])) : null, counters: a.perf() };
      }, { profiling, glProfile: process.env.SWEEP_GL_PROFILE === '1' });
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
      writeFileSync(`${dir}/${level}-${tier}-${backend}.json`, JSON.stringify({ level, tier, backend, seed: 2, viewport: { width: 1600, height: 900 }, rows }));
      console.log(JSON.stringify({ level, tier, backend, spot: spot.id, p95: row.p95, hitch: row.hitch, simMs: row.simMs, drawCalls: row.drawCalls, triangles: row.triangles, heapMB }));
      expect.soft(row.backend).toBe(backend); expect.soft(row.quality).toBe(tier);
      expect.soft(row.drawCalls).toBeGreaterThan(0);
      if (phase === 'after' || process.env.SWEEP_ASSERT_BUDGETS === '1') {
        expect.soft(row.p95).toBeLessThanOrEqual(tier === 'high' ? 16.7 : 33.3);
        expect.soft(row.hitch).toBeLessThanOrEqual(50);
        expect.soft(row.simMs).toBeLessThanOrEqual(tier === 'high' ? 4 : 6);
        expect.soft(row.drawCalls).toBeLessThanOrEqual(tier === 'high' ? 600 : 300);
        expect.soft(row.triangles).toBeLessThanOrEqual(tier === 'high' ? 1_500_000 : 500_000);
        expect.soft(heapMB).toBeLessThanOrEqual(tier === 'high' ? 400 : 250);
      }
    }
  });
