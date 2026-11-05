/** L9-S6 native crash/crawl budgets. Run after build under tools/perf/quiet-run.sh. */
import type { Game } from '../../src/Game';
import { SceneSession, stopServer, readSpec, writeJson } from '../scenelab/session';
const results: unknown[] = [];
try {
  for (const tier of ['high', 'low'] as const) {
    const session = new SceneSession({ tier, nativeFrameTiming: true, viewport: tier === 'high' ? { width: 1600, height: 900 } : { width: 390, height: 844 } });
    try {
      await session.open(); await session.load(readSpec('specs/scenes/catalog/l9-crash-sequence-0.json')); await session.ready();
      const cdp = await session.page.context().newCDPSession(session.page);
      if (tier === 'low') await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      await session.page.evaluate('globalThis.__name = (fn) => fn');
      const sample = await session.page.evaluate(async () => {
        const api = window.__SS__!, frames: number[] = [], sims: number[] = [];
        const world = (window.__SCENE__ as unknown as { game: Game }).game.world;
        const worst: { ms: number; tick: number; phase: string }[] = [];
        let previous = 0, draws = 0, triangles = 0, particles = 0, puffs = 0, parts = 0, lights = 0;
        // Warm the view while paused so the actual crash remains in the measured window.
        const warm = performance.now(); while (performance.now() - warm < 2000) await new Promise(r => requestAnimationFrame(r));
        api.resume(); const start = performance.now();
        while (performance.now() - start < 16000) {
          const now = await new Promise<number>(r => requestAnimationFrame(r));
          if (previous) { const ms = now - previous; frames.push(ms); if (ms > 30) worst.push({ ms, tick: world.tick, phase: world.missions!.l9!.state.phase }); } previous = now;
          const p = api.perf(); sims.push(p.simMs);
          draws = Math.max(draws, p.drawCalls); triangles = Math.max(triangles, p.triangles);
          particles = Math.max(particles, (p.effects?.particles ?? 0) + (p.effects?.blasts.puffs ?? 0));
          puffs = Math.max(puffs, p.effects?.blasts.puffs ?? 0); parts = Math.max(parts, p.effects?.blasts.parts ?? 0); lights = Math.max(lights, p.lighting?.heroLights ?? 0);
        }
        api.pause(); const p95 = (v: number[]) => v.sort((a, b) => a - b)[Math.ceil(v.length * .95) - 1];
        return { frameP95: p95(frames), hitch: Math.max(...frames), simP95: p95(sims), draws, triangles, particles, puffs, parts, lights, finished: api.getState().l9?.finished, worst: worst.sort((a, b) => b.ms - a.ms).slice(0, 10), heapMB: 0 };
      });
      await cdp.send('HeapProfiler.collectGarbage'); sample.heapMB = (await cdp.send('Runtime.getHeapUsage')).usedSize / 1048576;
      const limits = { frameP95: tier === 'high' ? 16.7 : 33.3, simP95: tier === 'high' ? 4 : 6, draws: tier === 'high' ? 600 : 300, triangles: tier === 'high' ? 1500000 : 500000, heapMB: tier === 'high' ? 400 : 250, particles: tier === 'high' ? 6000 : 2000, puffs: tier === 'high' ? 400 : 120, parts: tier === 'high' ? 120 : 40, lights: tier === 'high' ? 8 : 3, ...(tier === 'high' ? { hitch: 50 } : {}) };
      const pass = sample.finished && session.errors.length === 0 && Object.entries(limits).every(([k, cap]) => Number(sample[k as keyof typeof sample]) <= cap);
      results.push({ tier, ...sample, limits, pass, errors: session.errors });
      console.log(JSON.stringify(results.at(-1))); writeJson('test-results/epics/E31/S6/perf.json', results);
      if (!pass) process.exitCode = 1;
    } finally { await session.close(); }
  }
} finally { stopServer(); }
