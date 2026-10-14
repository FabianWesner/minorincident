import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from './session';
import type { SceneSpec } from '../../src/debug/scenelab/spec';

/** Run after a fresh build, through tools/perf/quiet-run.sh; one native headless Metal browser, E18 budgets unchanged. */
const phone = process.env.MEGA_PHONE === '1';
const out = process.env.MEGA_OUTPUT ?? (phone ? 'docs/reports/phone-perf/mega' : 'docs/reports/l10-mega-moves');
mkdirSync(out, { recursive: true });
const rows: unknown[] = [];
try {
  for (const tier of (phone ? ['low'] as const : ['high', 'low'] as const)) {
    const count = tier === 'high' ? 200 : 100;
    const session = new SceneSession({ phone, tier, backend: 'webgl2', nativeFrameTiming: true, viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 720 } });
    try {
      await session.open();
      if (phone) { const throttle = await session.page.context().newCDPSession(session.page); await throttle.send('Emulation.setCPUThrottlingRate', { rate: 4 }); }
      const spec: SceneSpec = {
        name: 'l10-mega-moves-perf', infectedCap: 200, size: 80, ground: 'asphalt', time: 'L4', dof: false,
        actors: [{ id: 'courier', kind: 'courier', at: [0, 0], god: true },
          { id: 'crowd', kind: 'infected', archetype: 'infected.runner', at: [0, 0], count: count - 1, spread: 18, state: 'chase' }],
        megaAlpha: { id: 'mega', at: [-8, 0] }, camera: { mode: 'game', target: [0, 2, 0], zoom: 1 },
      };
      await session.load(spec); await session.step(120);
      const cdp = await session.page.context().newCDPSession(session.page); await cdp.send('HeapProfiler.collectGarbage');
      const proof = await session.page.evaluate(async ({ quality, phone }) => {
        const a = window.__SS__!; await a.screenshotReady(); a.resume();
        const frames: number[] = [], sims: number[] = []; let previous = 0;
        const begin = performance.now();
        for (let i = 0; i < 720 || performance.now() - begin < 12000; i++) {
          const now = await new Promise<number>(requestAnimationFrame);
          if (i >= 120 && previous) { frames.push(now - previous); const p = a.perf(); if (!phone || p.simTickMs > 0) sims.push(phone ? p.simTickMs : p.simMs); }
          previous = now;
        }
        a.pause(); frames.sort((a, b) => a - b); sims.sort((a, b) => a - b);
        const perf = a.perf(), canvas = document.querySelector('canvas')!, gl = canvas.getContext('webgl2')!, ext = gl.getExtension('WEBGL_debug_renderer_info');
        return { quality, touchPoints: navigator.maxTouchPoints, backend: perf.backend, gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null, samples: frames.length,
          frameMsP95: frames[Math.ceil(frames.length * .95) - 1], simMsP95: sims[Math.ceil(sims.length * .95) - 1],
          drawCalls: perf.drawCalls, triangles: perf.triangles, count: a.getState().ai!.count,
          activations: a.events().filter(e => e.type === 'infected.special' && e.stage === 'active').length };
      }, { quality: tier, phone });
      const heap = await cdp.send('Runtime.getHeapUsage');
      rows.push({ ...proof, heapBytes: heap.usedSize, errors: session.errors });
      writeFileSync(`${out}/performance.json`, JSON.stringify(rows, null, 2) + '\n');
      const high = tier === 'high';
      if (phone && proof.touchPoints < 1) throw new Error('Mega phone probe requires touch emulation');
      if (proof.count !== count || !proof.activations || proof.frameMsP95 > (high ? 16.7 : 33.3) || proof.simMsP95 > (high ? 4 : 6) || proof.drawCalls > (high ? 600 : 300) || proof.triangles > (high ? 1500000 : 500000) || heap.usedSize > (high ? 400 : 250) * 1024 * 1024 || session.errors.length) throw new Error(`E18 Mega moves ${tier} budget failed: ${JSON.stringify(proof)}`);
    } finally { await session.close(); }
  }
} finally { stopServer(); }
