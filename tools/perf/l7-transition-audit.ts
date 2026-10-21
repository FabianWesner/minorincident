/** Native L7 checkpoint, boarding, departure and L8 handover timings.
 * SCENE_SERVER=preview SCENE_PORT=3932 sh tools/perf/quiet-run.sh sh tools/e2e-lock.sh npx tsx tools/perf/l7-transition-audit.ts
 * Setup positions the full authored cast; the measured transitions use the production systems.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import type { Game } from '../../src/Game';
import { SceneSession, stopServer } from '../scenelab/session';

const out = process.env.L7_TRANSITION_OUT ?? 'test-results/epics/E29/transitions';
const backend = process.env.L7_PERF_BACKEND === 'webgpu' ? 'webgpu' : 'webgl2';
mkdirSync(out, { recursive: true });
const rows: unknown[] = [];
try {
  for (const tier of ['high', 'low'] as const) {
    const session = new SceneSession({ backend, tier, phone: tier === 'low', nativeFrameTiming: true,
      viewport: tier === 'high' ? { width: 1600, height: 900 } : { width: 390, height: 844 }, query: { profile: '0', dpr: '1' } });
    try {
      await session.open();
      const cdp = await session.page.context().newCDPSession(session.page);
      if (tier === 'low') await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      await session.page.evaluate(async () => {
        const a = window.__SS__!; await a.loadLevel('L7', { seed: 29, progression: 'L7-default' }); a.pause(); a.cheats.god(true);
        a.settings.set({ slowMotion: false });
        const pickup = a.query({}).find(e => e.pickup && 'actionId' in e.pickup && e.pickup.actionId === 'weapon.rocket-launcher')!;
        a.teleport('player', pickup.transform); a.input.set({ interact: true }); await a.step(37); a.input.clear();
        a.teleport('player', { x: -40, z: 47 });
        a.getState().l7!.roster.forEach((r, i) => a.teleport(r.id, { x: -44 - Math.floor(i / 3) * 1.2, z: 46 + (i % 3 - 1) * 1.2 }));
        a.camera.cinematic({ position: [-22, 24, 68], target: [-48, 0, 46] }, true); await a.screenshotReady();
      });
      const gpu = await session.page.evaluate(async backend => {
        if (window.__SS__!.perf().backend !== (backend === 'webgpu' ? 'webgpu' : 'webgl')) throw Error('Requested backend was not selected');
        if (backend === 'webgpu') {
          const gpu = (navigator as Navigator & { gpu: { requestAdapter(): Promise<{ info: { vendor: string; architecture: string; device: string; description: string } } | null> } }).gpu;
          const adapter = await gpu.requestAdapter();
          return adapter ? `${adapter.info.vendor} ${adapter.info.architecture} ${adapter.info.device} ${adapter.info.description}` : null;
        }
        const gl = document.querySelector('canvas')!.getContext('webgl2')!;
        const extension = gl.getExtension('WEBGL_debug_renderer_info');
        return extension ? String(gl.getParameter(extension.UNMASKED_RENDERER_WEBGL)) : null;
      }, backend);
      if (!gpu || /swiftshader|llvmpipe|software/i.test(gpu)) throw Error(`Native GPU required: ${gpu}`);
      await session.page.evaluate('globalThis.__name = (fn) => fn');
      for (const phase of ['checkpoint', 'boarding'] as const) {
        if (phase === 'boarding') await session.page.evaluate(async () => {
          const a = window.__SS__!; a.teleport('player', { x: -70.5, z: 47.5 });
          a.getState().l7!.roster.filter(r => r.status === 'following').forEach((r, i) => a.teleport(r.id, { x: -70 + Math.floor(i / 3) * 1.2, z: 46 + (i % 3 - 1) * 1.2 }));
          a.camera.follow(); await a.screenshotReady();
        });
        const result = await session.page.evaluate(async phase => {
          const a = window.__SS__!, game = (window.__SCENE__ as unknown as { game: Game }).game, w = game.world;
          const warm = performance.now(); while (performance.now() - warm < 2000) await new Promise(requestAnimationFrame);
          const frames: number[] = [], hitches: unknown[] = [], transitions: unknown[] = [];
          let previous = 0, priorPhase = '', peakInfected = 0;
          a.resume(); if (phase === 'checkpoint') a.input.set({ moveTarget: { x: -29, z: 47 } });
          const start = performance.now();
          while (performance.now() - start < (phase === 'checkpoint' ? 5000 : 120000)) {
            const now = await new Promise<number>(r => requestAnimationFrame(r)), p = a.perf();
            const state = `${w.scenario}:${w.missions?.state.checkpoint}:${w.l7Departure?.state.phase ?? ''}`;
            if (previous) { frames.push(now - previous); if (now - previous > 30) hitches.push({ ms: now - previous, state, sim: p.simMs, update: p.updateCpuMs, render: p.renderCpuMs, nodeBuilds: p.nodeBuilds }); }
            if (state !== priorPhase) { transitions.push({ at: now - start, state, frameMs: now - previous }); priorPhase = state; }
            previous = now; peakInfected = Math.max(peakInfected, p.infected?.count ?? 0);
            if (w.scenario === 'L8' && !(game as unknown as { loading: boolean }).loading) break;
          }
          a.pause(); a.input.clear();
          const sorted = [...frames].sort((a,b) => a-b);
          return { phase, frames: frames.length, frameP95: sorted[Math.ceil(sorted.length * .95) - 1], maximum: Math.max(...frames), peakInfected, transitions, hitches,
            end: { level: w.scenario, loading: (game as unknown as { loading: boolean }).loading, checkpoint: w.missions?.state.checkpoint, departure: w.l7Departure?.state.phase }, perf: a.perf() };
        }, phase);
        rows.push({ backend, tier, gpu, ...result, errors: session.errors });
        writeFileSync(`${out}/transitions.json`, JSON.stringify(rows, null, 2));
        console.log(JSON.stringify(rows.at(-1)));
        if (result.maximum > 50 || (phase === 'checkpoint' ? result.end.checkpoint !== 'corridor' : result.end.level !== 'L8' || result.end.loading) || session.errors.length) process.exitCode = 1;
      }
    } finally { await session.close(); }
  }
} finally { stopServer(); }
