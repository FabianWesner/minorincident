/**
 * skinned-crowd prototype: 200-AI low-tier A/B on one production build (adapted from batch15's tex-infected-performance).
 *   npm run build:qa && SCENE_SERVER=preview SCENE_PORT=4622 sh tools/perf/quiet-run.sh npx tsx tools/scenelab/skinned-crowd-performance.ts
 * Variants (same dist, URL flag only):
 *   main-mix    perf-horde-200 as shipped (main's rigid crowd, mixed models)
 *   main-worker every actor inf.common-worker, main's rigid model
 *   skin        every actor inf.common-worker, the welded skinned TRELLIS body (?skinCrowd=1)
 *   skin-rigid  the same welded body on its dominant joint only (?skinCrowd=rigid): isolates the 4-influence cost
 * Order ABBA per backend; PHONE=1 adds the Pixel 7 + 4x CPU throttle proxy (WebGL2).
 */
import type { Game } from '../../src/Game';
import { resolve } from 'node:path';
import { SceneSession, stopServer, writeJson, type Backend } from './session';
process.env.SCENE_SERVER ??= 'preview';
const reportDir = resolve(import.meta.dirname, '../../test-results/skinned-crowd');
const variants: Record<string, { query: Record<string, string>; worker: boolean }> = {
  'main-mix': { query: {}, worker: false }, 'main-worker': { query: {}, worker: true },
  skin: { query: { skinCrowd: '1' }, worker: true }, 'skin-rigid': { query: { skinCrowd: 'rigid' }, worker: true },
};
const order = (process.env.VARIANTS ?? 'main-worker,skin,skin-rigid,main-mix,main-mix,skin-rigid,skin,main-worker').split(',');
const backends = (process.env.BACKENDS ?? 'webgl2,webgpu').split(',') as Backend[];
const phone = process.env.PHONE === '1', zoom = Number(process.env.ZOOM ?? 1.5);
const receipts: Record<string, unknown>[] = [];
const out = resolve(reportDir, `performance${phone ? '-phone' : ''}${zoom === 1.5 ? '' : `-z${zoom}`}.json`);
try {
  for (const backend of phone ? ['webgl2' as Backend] : backends) for (const variant of order) {
    const v = variants[variant];
    const session = new SceneSession({ backend, tier: 'low', nativeFrameTiming: true, phone, viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 720 }, query: v.query });
    try {
      await session.open();
      if (phone) { const cdp = await session.page.context().newCDPSession(session.page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); }
      const load = await session.page.evaluate(async ({ worker, zoom }) => {
        const a = window.__SS__!; const started = performance.now();
        await a.loadScenario('perf-horde-200'); a.pause(); a.cheats.god(true);
        const game = (window.__SCENE__ as unknown as { game: Game }).game;
        if (worker) for (const e of game.world.infected!.active) e.infected!.variant = 'inf.common-worker';
        a.camera.preset('perf-horde'); a.camera.zoom(zoom);
        await a.step(120); await a.screenshotReady();
        const measures = performance.getEntriesByType('measure').filter(m => m.name === 'view:infected-crowd' || m.name.startsWith('bake:inf.common-worker'));
        return { loadMs: performance.now() - started, measures: measures.map(m => ({ name: m.name, ms: m.duration })) };
      }, { worker: v.worker, zoom });
      const result = await session.page.evaluate(async () => {
        const a = window.__SS__!; a.resume();
        const frames: number[] = [], sim: number[] = []; let previous = 0, maxDraws = 0, maxCrowdDraws = 0, minSubmittedBodies = Infinity;
        const start = performance.now();
        for (let i = 0; i < 720 || performance.now() - start < 12000; i++) {
          const now = await new Promise<number>(requestAnimationFrame);
          if (i >= 120 && previous) { frames.push(now - previous); sim.push(a.perf().simMs); }
          previous = now;
          if (i % 60 === 0) { maxDraws = Math.max(maxDraws, a.perf().drawCalls); const crowd = a.getState().render.crowd; maxCrowdDraws = Math.max(maxCrowdDraws, crowd?.meshDrawCalls ?? 0); minSubmittedBodies = Math.min(minSubmittedBodies, crowd?.batches.reduce((n, b) => n + b.instances, 0) ?? 0); }
        }
        frames.sort((x, y) => x - y); sim.sort((x, y) => x - y);
        const state = a.getState(), perf = a.perf(); a.pause();
        const view = (window.__SCENE__ as unknown as { game: { view: { crowd: { batches: Map<string, { count: number; asset: string; lod: string; poses: { texture: { image: { width: number; height: number } } }; mesh: { geometry: { index: { count: number } | null; attributes: Record<string, unknown> } } }> } } } }).game.view;
        const batches = [...view.crowd.batches.values()].filter(b => b.count > 0).map(b => ({ asset: b.asset, lod: b.lod, instances: b.count, triangles: (b.mesh.geometry.index?.count ?? 0) / 3, skinned: '_skin' in b.mesh.geometry.attributes, poseTexture: [b.poses.texture.image.width, b.poses.texture.image.height], poseTextureBytes: b.poses.texture.image.width * b.poses.texture.image.height * 16 }));
        return { minSubmittedBodies, backend: perf.backend, tier: state.render.quality, count: state.ai?.count, p95: frames[Math.ceil(frames.length * .95) - 1], p50: frames[Math.ceil(frames.length * .5) - 1], simP95: sim[Math.ceil(sim.length * .95) - 1], samples: frames.length, drawCalls: perf.drawCalls, maxDraws, maxCrowdDraws, triangles: perf.triangles, batches };
      });
      receipts.push({ variant, phone, zoom, ...load, ...result, errors: session.errors.slice(0, 3) });
      writeJson(out, receipts);
      console.log(JSON.stringify({ variant, backend, phone, p95: result.p95, p50: result.p50, count: result.count, crowdDraws: result.maxCrowdDraws, draws: result.maxDraws, loadMs: Math.round(load.loadMs), errors: session.errors.length }));
    } finally { await session.close(); stopServer(); }
    for (let i = 0; i < 20; i++) { try { await fetch(`http://127.0.0.1:${process.env.SCENE_PORT ?? 3341}`); await new Promise(r => setTimeout(r, 100)); } catch { break; } }
  }
} finally { stopServer(); writeJson(out, receipts); }
