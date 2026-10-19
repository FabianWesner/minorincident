/** S3/S4 full-route real-physics APC probe, including the on-main S6 forced crash.
 * Run SCENE_SERVER=preview under tools/perf/quiet-run.sh after npm run build.
 * All three profiles use headless native Metal, one browser at a time. */
import { crossing } from '../../src/levels/L9/district';
import { SceneSession, stopServer, writeJson } from '../scenelab/session';
import type { SceneSpec } from '../../src/debug/scenelab/spec';
import { execFileSync } from 'node:child_process';
import type { Game } from '../../src/Game';
import { writeFileSync } from 'node:fs';

const output = process.env.L9_OUTPUT ?? 'test-results/epics/E31/l9-stream';
const requestedBackend = process.env.L9_BACKEND === 'webgpu' ? 'webgpu' : 'webgl2';
// The quiet gate can queue behind other jobs: build the current sources after admission.
execFileSync('npm', ['run', 'build'], { stdio: 'inherit' });
const results: unknown[] = [];
try {
  for (const profile of (['high', 'low', 'phone'] as const).filter(p => !process.env.L9_PROFILE || p === process.env.L9_PROFILE)) {
    const low = profile !== 'high', cap = low ? 100 : 200;
    const session = new SceneSession({ phone: profile === 'phone', backend: requestedBackend, tier: low ? 'low' : 'high', nativeFrameTiming: true, query: { loadProfile: '1' }, viewport: profile === 'phone' ? { width: 390, height: 844 } : { width: 1600, height: 900 } });
    try {
      await session.open();
      const cdp = await session.page.context().newCDPSession(session.page);
      if (profile === 'phone') await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      for (const route of crossing.routes.filter(r => !process.env.L9_ROUTE || r.id === process.env.L9_ROUTE)) {
        const spec: SceneSpec = { name: `l9-stream-${route.id}`, ground: 'district', time: 'L9-crossing', dof: false,
          layout: { district: 'D-CROSSING', bbox: [[-600, -400], [600, 400]], anchors: ['crossing-start', 'outskirts', 'crash-approach', 'crash-impact', 'crash-wreck', 'crawl-start', 'crawl-fallback', 'crawl-end'] }, infectedCap: 200,
          crossingCrash: { health: process.env.L9_FLOOR === '1' ? 0 : 1000, driveFromStart: true },
          actors: [{ id: 'crowd', kind: 'infected', count: cap, spread: 20, at: [-550, 40], state: 'idle' }],
          vehicles: [{ id: 'apc', asset: 'vehicle.military-apc', at: crossing.start, yaw: 0, path: route.points, ...(process.env.L9_FLOOR === '1' ? { floor: true, health: 0 } : {}) }],
          camera: { mode: 'game', target: 'apc', zoom: 1 } };
        await session.load(spec); await session.ready();
        await session.page.evaluate(() => window.__SS__!.debug.figureJoints(false));
        // As in the existing E18 probes: exclude transient level-load garbage
        // from the after-warmup timing window, while all route streaming remains measured.
        await cdp.send('HeapProfiler.collectGarbage');
        const cpuProfile = process.env.L9_CPU_PROFILE === `${profile}/${route.id}`;
        if (cpuProfile) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.start'); }
        await session.page.evaluate('globalThis.__name = (fn) => fn');
        const measurement = await session.page.evaluate(async ({ cap, diagnose }) => {
          const api = window.__SS__!;
          const game = (window.__SCENE__ as unknown as { game: Game }).game, world = game.world;
          const gl = (game.view.renderer as unknown as { backend: { gl?: WebGL2RenderingContext } }).backend.gl;
          const debugGpu = gl?.getExtension('WEBGL_debug_renderer_info');
          const navigatorGpu = navigator as Navigator & { gpu?: { requestAdapter(): Promise<{ info: { vendor: string; description: string; architecture: string } } | null> } };
          const adapter = gl ? null : await navigatorGpu.gpu?.requestAdapter();
          const gpu = gl ? String(gl.getParameter(debugGpu?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER)) : `${adapter?.info.vendor ?? ''} ${adapter?.info.description ?? ''} ${adapter?.info.architecture ?? ''}`;
          const coldPipelines: unknown[] = [];
          const backend = (game.view.renderer as unknown as { backend: { createRenderPipeline(...args: unknown[]): unknown } }).backend;
          const createPipeline = backend.createRenderPipeline;
          if (diagnose) backend.createRenderPipeline = function (...args) {
            const t = performance.now(), result = createPipeline.apply(this, args), ms = performance.now() - t;
            if (ms > 20) {
              const ro = args[0] as { material: { name: string }; object: { name: string; parent?: unknown } };
              const ancestry: string[] = [];
              for (let node: { name: string; parent?: unknown } | undefined = ro.object; node; node = node.parent as typeof node) ancestry.push(node.name);
              coldPipelines.push({ ms, material: ro.material.name, ancestry, at: performance.now() });
            }
            return result;
          };
          api.setTimeScale(2);
          const car = api.query({ kind: 'vehicle', archetype: 'vehicle.military-apc' })[0];
          if (!car) throw Error('Missing APC');
          const crowd = api.query({ kind: 'infected' });
          if (crowd.length !== cap) throw Error(`Crowd cap ${crowd.length}/${cap}`);
          const camera = api.getState().render.camera;
          const offset = camera.position.map((v, i) => v - camera.target[i]);
          const frames: number[] = [], sims: number[] = [], samples: unknown[] = [], hitches: unknown[] = [];
          let previous = 0, draws = 0, triangles = 0, resident = 0, hitch = 0, loading = 0, relocated = 0, distance = 0, last = car.transform;
          let geometries = 0, heapPeakMB = 0;
          let shadowTriangles = 0, submittedTriangles = 0;
          let heroLights = 0, awakeProps = 0, particles = 0, puffs = 0, parts = 0;
          const start = performance.now(); api.resume();
          while (performance.now() - start < 240_000) {
            const now = await new Promise<number>(r => requestAnimationFrame(r)), e = api.getEntity(car.id);
            // S7 handover removes the wrecked APC entity once the crawl begins: the route is complete.
            if (!e) break;
            const p = api.perf();
            // Keep the authored game-camera offset via the public camera pose API.
            // Scene Lab's setCamera also renders: calling it every RAF doubled
            // view-sync work and overwrote counters with a cached post-FX pass.
            api.camera.cinematic({ target: [e.transform.x, 0, e.transform.z], position: [e.transform.x + offset[0], offset[1], e.transform.z + offset[2]] }, true);
            if (now - start > 3000) {
              if (previous) { const elapsed = Math.round((now - previous) * 1000) / 1000; frames.push(elapsed); hitch = Math.max(hitch, elapsed); if (elapsed > 50) hitches.push({ elapsed, position: e.transform, terrain: p.terrain, updateCpuMs: p.updateCpuMs, renderCpuMs: p.renderCpuMs, nodeBuilds: p.nodeBuilds }); }
              if (p.simTickMs > 0) sims.push(p.simTickMs);
              // PostFx resets renderer.info between passes. The opt-in backend
              // profile counts every submitted scene/shadow/fullscreen draw.
              const submitted = Object.values(p.profile ?? {}).reduce((total, part) => ({ drawCalls: total.drawCalls + part.drawCalls, triangles: total.triangles + part.triangles }), { drawCalls: 0, triangles: 0 });
              draws = Math.max(draws, submitted.drawCalls);
              // E18 budgets "triangles in view", as Scene Lab's metrics do.
              // Keep shadow and total submissions in the evidence separately.
              triangles = Math.max(triangles, Object.entries(p.profile ?? {}).filter(([category]) => category !== 'shadows').reduce((n, [, part]) => n + part.triangles, 0));
              shadowTriangles = Math.max(shadowTriangles, p.profile?.shadows?.triangles ?? 0); submittedTriangles = Math.max(submittedTriangles, submitted.triangles);
              resident = Math.max(resident, p.terrain?.resident ?? 0); loading = Math.max(loading, p.terrain?.loading ?? 0);
              geometries = Math.max(geometries, p.geometries); heapPeakMB = Math.max(heapPeakMB, (p.heapBytes ?? 0) / 1e6);
              heroLights = Math.max(heroLights, p.lighting?.heroLights ?? 0); awakeProps = Math.max(awakeProps, p.awakeProps);
              puffs = Math.max(puffs, p.effects?.blasts.puffs ?? 0); parts = Math.max(parts, p.effects?.blasts.parts ?? 0);
              particles = Math.max(particles, (p.effects?.particles ?? 0) + (p.effects?.blasts.puffs ?? 0));
            }
            previous = now;
            distance += Math.hypot(e.transform.x - last.x, e.transform.z - last.z); last = e.transform;
            // Fixed populated stress, kept off the hull, along the entire route.
            if (now - relocated > 1000) {
              const yaw = e.transform.yaw, dx = Math.cos(yaw), dz = -Math.sin(yaw);
              // The public teleport helper renders immediately too. Move the
              // fixture entities in the sim store, as Scene Lab's own teleport
              // does, and let the normal next frame synchronize all of them.
              crowd.forEach((inf, i) => {
                const entity = world.entities.get(inf.id)!, back = 8 + Math.floor(i / 20) * .7, side = (i % 20 - 9.5) * .65;
                entity.transform.x = e.transform.x - dx * back + dz * side;
                entity.transform.z = e.transform.z - dz * back - dx * side;
                world.spatial.set(entity.id, entity.transform.x, entity.transform.z);
              });
              samples.push({ distance, position: e.transform, ...p.terrain, geometries: p.geometries }); relocated = now;
            }
            if (world.missions?.l9?.state.finished) break;
          }
          api.pause(); api.setTimeScale(1); await api.screenshotReady();
          if (diagnose) backend.createRenderPipeline = createPipeline;
          const final = api.getEntity(car.id) ?? last, p95 = (v: number[]) => v.sort((a, b) => a - b)[Math.ceil(v.length * .95) - 1];
          return { completed: !!world.missions?.l9?.state.finished, crash: world.missions?.l9?.snapshot(),
            seconds: (performance.now() - start) / 1000, distance, frameP50: [...frames].sort((a,b) => a-b)[Math.ceil(frames.length * .5) - 1], frameP95: p95(frames), frameP99: frames[Math.ceil(frames.length * .99) - 1], simP95: p95(sims), hitch, draws, triangles, resident, loading, geometries, heapPeakMB,
            final: 'transform' in final ? final.transform : final, hp: 'health' in final ? final.health.current : 0, samples, hitches, coldPipelines, shadowTriangles, submittedTriangles, heroLights, awakeProps, particles, puffs, parts, gpu, touchPoints: navigator.maxTouchPoints, terrain: api.perf().terrain, backend: api.perf().backend, infected: api.perf().infected?.count, nodeBuilds: api.perf().nodeBuilds };
        }, { cap, diagnose: cpuProfile });
        if (cpuProfile) writeFileSync('/tmp/l9-stream-cpu.json', JSON.stringify((await cdp.send('Profiler.stop')).profile));
        await cdp.send('HeapProfiler.collectGarbage');
        const heap = await cdp.send('Runtime.getHeapUsage');
        const limits = { frameP95: low ? 33.3 : 16.7, simP95: low ? 6 : 4, draws: low ? 300 : 600, triangles: low ? 500000 : 1500000, resident: low ? 9 : 25, heapMB: low ? 250 : 400, heroLights: low ? 3 : 8, awakeProps: low ? 60 : 150, particles: low ? 2000 : 6000, puffs: low ? 120 : 400, parts: low ? 40 : 120 };
        const heapMB = heap.usedSize / 1e6;
        const pass = measurement.backend === (requestedBackend === 'webgpu' ? 'webgpu' : 'webgl') && measurement.completed && measurement.infected === cap && measurement.draws > 1 && (profile !== 'phone' || measurement.touchPoints > 0) && !/swiftshader|llvmpipe|software/i.test(measurement.gpu) && session.errors.length === 0 && heapMB <= limits.heapMB && Object.entries(limits).filter(([key]) => key !== 'heapMB').every(([key, limit]) => measurement[key as keyof typeof measurement] as number <= limit) && (profile === 'phone' || measurement.hitch <= 50);
        const result = { profile, route: route.id, ...measurement, heapMB, heap, limits, pass, errors: session.errors };
        results.push(result); writeJson(`${output}/performance.json`, results);
        console.log(JSON.stringify({ ...result, samples: undefined, hitches: undefined, terrain: undefined, heap: undefined, final: undefined }));
        if (!pass) process.exitCode = 1;
      }
      if (process.env.L9_CPU_PROFILE || process.env.L9_SKIP_MEMORY === '1') continue;
      // Five complete outward/backward camera sweeps, same resident cell set at each endpoint.
      const rounds = [];
      for (let lap = 0; lap <= 5; lap++) {
        // Both directions traverse the intermediate cells. A direct 900 m
        // teleport disposes every render object and correctly rebuilds a graph;
        // that is not a driving round trip or a useful cold-shader regression.
        const outward = Array.from({ length: 10 }, (_, i) => -450 + i * 100);
        for (const x of [...outward, ...outward.slice(0, -1).reverse()]) {
          await session.page.evaluate(x => {
            const game = (window.__SCENE__ as unknown as { game: Game }).game;
            game.world.chunks?.update([x, 0]);
            window.__SCENE__!.setCamera({ mode: 'game', target: [x, 0], zoom: 1 });
          }, x); await session.ready();
        }
        await cdp.send('HeapProfiler.collectGarbage');
        rounds.push({ heap: (await cdp.send('Runtime.getHeapUsage')).usedSize, perf: await session.page.evaluate(() => window.__SS__!.perf()), residency: await session.page.evaluate(() => window.__SS__!.getState().chunkResidency) });
      }
      const first = rounds[0], last = rounds[5];
      const pass = last.heap <= first.heap * 1.1 && last.perf.geometries <= first.perf.geometries * 1.1 && last.perf.textures <= first.perf.textures * 1.1 && last.perf.nodeBuilds === first.perf.nodeBuilds;
      writeJson(`${output}/memory-${profile}.json`, { rounds, pass }); if (!pass) process.exitCode = 1;
    } finally { await session.close(); }
  }
} finally { stopServer(); }
