import { strict as assert } from 'node:assert';
import { mkdirSync } from 'node:fs';
import { SceneSession, stopServer, readSpec, writeJson } from './session';
import type { Game } from '../../src/Game';
import type { SceneSpec } from '../../src/debug/scenelab/spec';
const output = 'test-results/epics/E31/l9-s1'; mkdirSync(output, { recursive: true });
try {
  for (const tier of ['high', 'low'] as const) {
    const session = new SceneSession({ tier, nativeFrameTiming: true, viewport: tier === 'high' ? { width: 1600, height: 900 } : { width: 390, height: 844 } });
    try {
      await session.open();
      for (const scene of ['ram', 'surrounded']) {
        const spec = readSpec(`tests/scenes/l9-apc/${scene}.json`);
        await session.load(spec); await session.ready();
        // Scene Lab supplies L1 search brains; L9 uses the ordinary infected chase/contact path.
        await session.page.evaluate(() => {
          const w = (window.__SCENE__ as unknown as { game: Game }).game.world;
          for (const e of w.infected!.active) { delete e.infected!.l1; e.infected!.state = 'chase'; }
        });
        const cells: { frame: number; jpeg: Buffer }[] = [];
        let previous = 0;
        for (const frame of spec.shots!) {
          await session.step(frame - previous); previous = frame;
          await session.screenshot(`${output}/${tier}-${scene}-${frame}.png`);
          cells.push({ frame, jpeg: await session.snapshot() });
        }
        await session.makeSheet(cells, `${output}/${tier}-${scene}.jpg`);
        writeJson(`${output}/${tier}-${scene}-state.json`, await session.page.evaluate(() => {
          const w = (window.__SCENE__ as unknown as { game: Game }).game.world;
          return { car: [...w.vehicles!.cars.values()][0].entity, events: w.events.events().filter(e => e.type.startsWith('vehicle.') || e.type === 'combat.hit' || e.type === 'combat.kill') };
        }));
      }
      // Populated isolated resolver fixture: 200/100 live infected, four aware hull attackers.
      // All agents run their chase AI; zero speed keeps this isolated fixture spatially stable.
      const count = tier === 'high' ? 200 : 100;
      const spec: SceneSpec = { name: `l9-apc-budget-${tier}`, seed: 31, size: 100, ground: 'asphalt', time: 'L6', dof: false, infectedCap: 200,
        actors: [{ id: 'courier', kind: 'courier', at: [.71, 2.025], yaw: 90 }, ...Array.from({ length: count }, (_, i) => ({ id: `infected-${i}`, kind: 'infected' as const, archetype: 'infected.runner', at: (i < 4 ? [[1, 2.5], [-1, 2.5], [1, -2.5], [-1, -2.5]][i] : [-18 + (i % 20) * 1.8, -12 - Math.floor(i / 20) * 1.8]) as [number, number] }))],
        vehicles: [{ id: 'apc', asset: 'vehicle.military-apc', at: [0, 0] }], camera: { mode: 'game', target: 'apc' } };
      await session.load(spec); await session.step(1); await session.ready();
      const cdp = await session.page.context().newCDPSession(session.page);
      await cdp.send('HeapProfiler.collectGarbage');
      if (tier === 'low') await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      const proof = await session.page.evaluate(async () => {
        const lab = window.__SCENE__!, api = window.__SS__!, w = (lab as unknown as { game: Game }).game.world;
        for (const e of w.infected!.active) { delete e.infected!.l1; e.infected!.speed = 0; e.infected!.state = 'chase'; }
        api.resume(); const frames: number[] = [], sim: number[] = []; let previous = 0;
        const start = performance.now();
        for (let i = 0; i < 840 || performance.now() - start < 14000; i++) {
          const now = await new Promise<number>(requestAnimationFrame);
          if (i >= 120 && previous) { frames.push(now - previous); sim.push(api.perf().simMs); }
          previous = now;
        }
        api.pause(); frames.sort((a, b) => a - b); sim.sort((a, b) => a - b);
        const perf = api.perf(), gl = document.querySelector('canvas')!.getContext('webgl2')!, ext = gl.getExtension('WEBGL_debug_renderer_info');
        return { gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null, infected: w.infected!.active.length, frameP95: frames[Math.ceil(frames.length * .95) - 1], simP95: sim[Math.ceil(sim.length * .95) - 1], draws: perf.drawCalls, triangles: perf.triangles, carHP: [...w.vehicles!.cars.values()][0].entity.health.current, samples: frames.length };
      });
      await cdp.send('HeapProfiler.collectGarbage'); const heap = await cdp.send('Runtime.getHeapUsage'); await cdp.detach();
      writeJson(`${output}/${tier}-performance.json`, { tier, cpuThrottleRate: tier === 'low' ? 4 : 1, ...proof, heapMB: heap.usedSize / 1_000_000, errors: session.errors });
      await session.screenshot(`${output}/${tier}-populated.png`);
      assert.equal(proof.infected, count); assert(proof.frameP95 <= (tier === 'high' ? 16.7 : 33.3)); assert(proof.simP95 <= (tier === 'high' ? 4 : 6));
      assert(proof.draws <= (tier === 'high' ? 600 : 300)); assert(proof.triangles <= (tier === 'high' ? 1500000 : 500000)); assert(heap.usedSize / 1_000_000 <= (tier === 'high' ? 400 : 250)); assert.equal(session.errors.length, 0);
      console.log(JSON.stringify({ tier, ...proof, heapMB: heap.usedSize / 1_000_000 }));
    } finally { await session.close(); }
  }
} finally { stopServer(); }
