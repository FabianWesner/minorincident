import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from './session';
import { zooStaffLook } from '../../src/data/zooStaff';
import type { ActorSpec, SceneSpec } from '../../src/debug/scenelab/spec';
const output = 'docs/reports/l8-systems'; mkdirSync(output, { recursive: true });
const results = [];
try {
  for (const tier of ['high', 'low'] as const) {
    const s = new SceneSession({ tier, nativeFrameTiming: true, viewport: tier === 'high' ? { width: 1280, height: 720 } : { width: 390, height: 844 } });
    try {
      await s.open();
      const count = tier === 'high' ? 200 : 100;
      const animals = ['lion', 'gorilla', 'elephant', 'zebra', 'zebra', 'flamingo', 'flamingo', 'flamingo'] as const;
      const actors: ActorSpec[] = [{ id: 'courier', kind: 'courier', at: [0, 12] }];
      animals.forEach((species, i) => actors.push({ id: `animal-${i}`, kind: 'animal', species, at: [-14 + i * 4, 3] }));
      for (let i = 0; i < 30; i++) actors.push({ id: `human-${i}`, kind: 'pedestrian', at: [-15 + i % 10 * 3, 16 + Math.floor(i / 10) * 3], look: i >= 6 && i < 10 ? zooStaffLook(i - 6) : { model: i < 6 ? 'npc.national-guard' : 'npc.civilian-man-a', role: i < 6 ? 'soldier' : i < 10 ? 'staff' : 'civilian' } });
      for (let i = 0; i < count - animals.length; i++) actors.push({ id: `infected-${i}`, kind: 'infected', archetype: i < 3 ? 'infected.alpha' : 'infected.runner', at: [-16 + i % 20 * 1.6, -16 + Math.floor(i / 20) * 1.6] });
      const spec: SceneSpec = { name: `l8-systems-budget-${tier}`, seed: 30, size: 70, ground: 'sidewalk', time: 'night', infectedCap: 200, actors, camera: { mode: 'game', target: [0, 0], zoom: 2 } };
      await s.load(spec); await s.step(120); await s.ready();
      const cdp = await s.page.context().newCDPSession(s.page);
      await cdp.send('HeapProfiler.collectGarbage');
      if (tier === 'low') await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      const proof = await s.page.evaluate(async () => {
        const a = window.__SS__!, lab = window.__SCENE__!;
        const ids = Array.from({ length: 8 }, (_, i) => lab.actors.get(`animal-${i}`)!.entity);
        const initial = a.getState();
        for (let i = 0; i < 8; i++) lab.command(`animal-${i}`, { infect: {} });
        a.resume(); const frames: number[] = [], sim: number[] = []; let previous = 0;
        const start = performance.now(); let hitch = 0;
        for (let i = 0; i < 840 || performance.now() - start < 14000; i++) {
          const now = await new Promise<number>(requestAnimationFrame);
          if (i >= 120 && previous) { frames.push(now - previous); sim.push(a.perf().simMs); }
          if (i < 420 && previous) hitch = Math.max(hitch, now - previous);
          previous = now;
        }
        a.pause(); frames.sort((a, b) => a - b); sim.sort((a, b) => a - b);
        const final = a.getState(), perf = a.perf(), gl = document.querySelector('canvas')!.getContext('webgl2')!, ext = gl.getExtension('WEBGL_debug_renderer_info');
        return { gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null, infected: final.ai!.count, healthy: initial.entities.filter(e => e.civilian?.zooAnimal).length, locals: initial.entities.filter(e => e.civilian && !e.civilian.zooAnimal).length, turns: ids.map(id => final.entities.find(e => e.id === id)?.archetype), frameP95: frames[Math.ceil(frames.length * .95) - 1], simP95: sim[Math.ceil(sim.length * .95) - 1], conversionHitchMax: hitch, drawCalls: perf.drawCalls, triangles: perf.triangles, heapBytes: perf.heapBytes, bars: final.render.healthBars?.count, samples: frames.length, elapsedMs: performance.now() - start };
      });
      await cdp.send('HeapProfiler.collectGarbage'); const heap = await cdp.send('Runtime.getHeapUsage');
      results.push({ tier, cpuThrottleRate: tier === 'low' ? 4 : 1, ...proof, heapUsedBytes: heap.usedSize, errors: s.errors }); writeFileSync(`${output}/performance.json`, JSON.stringify(results, null, 2) + '\n');
      const high = tier === 'high';
      if (proof.infected !== count || proof.healthy !== 8 || proof.locals !== 30 || proof.turns.some(id => !id?.startsWith('infected.')) || proof.frameP95 > (high ? 16.7 : 33.3) || proof.simP95 > (high ? 4 : 6) || proof.drawCalls > (high ? 600 : 300) || proof.triangles > (high ? 1500000 : 500000) || heap.usedSize > (high ? 400 : 250) * 1024 * 1024 || high && proof.conversionHitchMax > 50 || s.errors.length) throw new Error(`${tier} E18 budget failed`);
    } finally { await s.close(); }
  }
} finally { stopServer(); }
