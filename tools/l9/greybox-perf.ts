/** Native Metal D1 budget probe. Sweep every route at both quality tiers with
 * 200/100 idle infected; encounters and delayed streaming stress belong to Q1/Q2.
 * Run with SCENE_SERVER=preview SCENE_UNCAPPED=1 under tools/perf/quiet-run.sh. */
import { crossing, crossingRouteLength } from '../../src/levels/L9/district';
import type { Point } from '../../src/levels/districts/types';
import { SceneSession, stopServer, readSpec, writeJson } from '../scenelab/session';

const probes = crossing.routes.flatMap(route => {
  const centers: Point[] = [];
  for (let i = 1; i < route.points.length; i++) {
    const a = route.points[i - 1], b = route.points[i], length = crossingRouteLength([a, b]);
    for (let d = 0; d < length; d += 200) centers.push([a[0] + (b[0] - a[0]) * d / length, a[1] + (b[1] - a[1]) * d / length]);
  }
  centers.push(crossing.outskirts);
  return centers.map((center, index) => ({ route: route.id, center, index }));
});
const results: unknown[] = [];
try {
  for (const tier of ['high', 'low'] as const) {
    const session = new SceneSession({ tier, viewport: tier === 'high' ? { width: 1600, height: 900 } : { width: 390, height: 844 } });
    try {
      await session.open();
      if (tier === 'low') {
        const cdp = await session.page.context().newCDPSession(session.page);
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      }
      const cap = tier === 'high' ? 200 : 100;
      const spec = readSpec('tests/scenes/l9-greybox/road.json');
      spec.camera = { mode: 'game', target: crossing.start };
      spec.layout!.bbox = [[-600, -400], [600, 400]];
      spec.infectedCap = 200;
      spec.actors = [
        { id: 'courier', kind: 'courier', at: crossing.start, state: 'idle' },
        { id: 'crowd', kind: 'infected', count: cap, spread: 20, at: crossing.start, state: 'idle' },
      ];
      await session.load(spec);
      await session.ready();
      // tsx names nested callbacks when serializing them into the browser.
      await session.page.evaluate('globalThis.__name = (fn) => fn');
      for (const { route, center, index } of probes) {
        await session.page.evaluate(center => {
          const api = window.__SS__!;
          api.pause(); api.teleport('player', { x: center[0], z: center[1] });
          const crowd = api.query({ kind: 'infected' });
          crowd.forEach((e, i) => api.teleport(e.id, {
            x: center[0] + Math.cos(i / crowd.length * Math.PI * 2) * 20,
            z: center[1] + Math.sin(i / crowd.length * Math.PI * 2) * 20,
          }));
          window.__SCENE__!.setCamera({ mode: 'game', target: center });
        }, center);
        await session.ready();
        const sample = await session.page.evaluate(async () => {
          const api = window.__SS__!; api.resume();
          const warm = performance.now();
          while (performance.now() - warm < 3000) await new Promise(r => requestAnimationFrame(r));
          const frames: number[] = [], sims: number[] = [], draws: number[] = [], triangles: number[] = [];
          let previous = 0, heroLights = 0, awakeProps = 0, particles = 0, puffs = 0, parts = 0; const start = performance.now();
          while (performance.now() - start < 4000) {
            const now = await new Promise<number>(r => requestAnimationFrame(r));
            if (previous) frames.push(Math.round((now - previous) * 1000) / 1000); previous = now;
            const p = api.perf(); sims.push(p.simMs); draws.push(p.drawCalls); triangles.push(p.triangles);
            heroLights = Math.max(heroLights, p.lighting?.heroLights ?? 0); awakeProps = Math.max(awakeProps, p.awakeProps);
            puffs = Math.max(puffs, p.effects?.blasts.puffs ?? 0); parts = Math.max(parts, p.effects?.blasts.parts ?? 0);
            particles = Math.max(particles, (p.effects?.particles ?? 0) + (p.effects?.blasts.puffs ?? 0));
          }
          api.pause();
          const p95 = (v: number[]) => v.sort((a, b) => a - b)[Math.ceil(v.length * .95) - 1];
          return { frameP95: p95(frames), simP95: p95(sims), draws: Math.max(...draws), triangles: Math.max(...triangles), heapMB: 0, heroLights, awakeProps, particles, puffs, parts, infected: api.perf().infected?.count ?? 0 };
        });
        const cdp = await session.page.context().newCDPSession(session.page);
        await cdp.send('HeapProfiler.collectGarbage');
        sample.heapMB = (await cdp.send('Runtime.getHeapUsage')).usedSize / 1048576;
        const limits = { draws: tier === 'high' ? 600 : 300, triangles: tier === 'high' ? 1500000 : 500000, heapMB: tier === 'high' ? 400 : 250, simP95: tier === 'high' ? 4 : 6, frameP95: tier === 'high' ? 16.7 : 33.3, heroLights: tier === 'high' ? 8 : 3, awakeProps: tier === 'high' ? 150 : 60, particles: tier === 'high' ? 6000 : 2000, puffs: tier === 'high' ? 400 : 120, parts: tier === 'high' ? 120 : 40 };
        const pass = sample.infected === cap && session.errors.length === 0 && Object.entries(limits).every(([k, v]) => sample[k as keyof typeof sample] <= v);
        const result = { tier, route, index, center, ...sample, limits, pass, consoleErrors: session.errors };
        results.push(result); console.log(JSON.stringify(result));
        writeJson('test-results/epics/E31/l9-greybox/perf.json', results);
        if (!pass) process.exitCode = 1;
      }
    } finally { await session.close(); }
  }
} finally { stopServer(); }
