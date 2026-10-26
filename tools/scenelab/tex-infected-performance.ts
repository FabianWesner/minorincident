/** Native low-tier A/B. quiet-run owns the GPU; both roots serve remote production builds. */
import type { Game } from '../../src/Game';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { SceneSession, stopServer, writeJson, type Backend } from './session';
const worktree = resolve(import.meta.dirname, '../..'), main = resolve(process.env.TEX_MAIN_ROOT ?? '/private/tmp/tex-infected-main-36a960fc');
const afterDist = process.env.TEX_DIST ?? 'dist';
process.env.SCENE_SERVER = 'preview';
const reportDir = resolve(worktree, process.env.TEX_REPORT_DIR ?? 'test-results/tex-infected');
const report = resolve(reportDir, 'performance.json');
const receipts: { variant: string; scene: string; backend: string; p95: number; maxCrowdDraws: number; triangles: number; errors: string[] }[] = [];
try {
  for (const backend of ['webgl2', 'webgpu'] as Backend[]) for (const variant of ['main', 'after', 'after', 'main']) {
    process.chdir(variant === 'main' ? main : worktree);
    process.env.SCENE_DIST = variant === 'main' ? 'dist' : afterDist;
    const session = new SceneSession({ backend, tier: 'low', nativeFrameTiming: true, viewport: { width: 1280, height: 720 } });
    try {
      await session.open();
      for (const scene of ['crowd-200', 'L1']) {
        if (scene === 'crowd-200') {
          await session.page.evaluate(async () => {
            const a = window.__SS__!; await a.loadScenario('perf-horde-200'); a.pause(); a.cheats.god(true);
            // The shipped benchmark already retains 200 actors on both quality tiers.
            // Exercise this exact existing asset on every actor, using the normal runner AI.
            const game = (window.__SCENE__ as unknown as { game: Game }).game;
            for (const e of game.world.infected!.active) e.infected!.variant = 'inf.common-worker';
            a.camera.preset('perf-horde'); a.camera.zoom(1.5);
            await a.step(120); await a.screenshotReady();
          });
        } else {
          await session.page.evaluate(async () => {
            const a = window.__SS__!; await a.loadLevel('L1', { seed: 1 }); a.pause(); a.missions.begin(); a.cheats.god(true);
            const p = a.getEntity(1)!.transform; let count = 0;
            for (let i = 0; i < 100 && count < 20; i++) {
              try { a.spawn('infected.runner', { x: p.x + i % 10 * .9 - 4.5, z: p.z + Math.floor(i / 10) * .9 + 2 }, { state: 'chase' }); count++; } catch { /* District navigation rejects a house or parked car. */ }
            }
            if (count !== 20) throw new Error(`L1 reference admission: ${count}/20`);
            a.camera.follow(); a.camera.zoom(1); await a.step(120); await a.screenshotReady();
          });
        }
        // Shared admission leaves another lane free to start. Reject overlapping
        // browser work instead of presenting contaminated clocks as quiet timing.
        let overlappingBrowser = false;
        const monitor = setInterval(() => {
          const roots = execFileSync('ps', ['-axo', 'command='], { encoding: 'utf8' }).split('\n').filter(line => /^\/(?:.*\/)?(?:chrome-headless-shell|Chromium|Google Chrome) /.test(line) && !line.includes('--type=') && (line.includes('headless') || line.includes('--remote-debugging')));
          if (roots.length > 1) overlappingBrowser = true;
        }, 1000);
        let result;
        try {
        result = await session.page.evaluate(async () => {
          const a = window.__SS__!; a.resume();
          const frames: number[] = [], sim: number[] = []; let previous = 0, maxDraws = 0, maxCrowdDraws = 0, minSubmittedBodies = Infinity;
          const start = performance.now(), startTick = a.tick(), startRender = a.perf().renderedFrames;
          for (let i = 0; i < 720 || performance.now() - start < 12000; i++) {
            const now = await new Promise<number>(requestAnimationFrame);
            if (i >= 120 && previous) { frames.push(now - previous); sim.push(a.perf().simMs); }
            previous = now;
            if (i % 60 === 0) { maxDraws = Math.max(maxDraws, a.perf().drawCalls); const crowd = a.getState().render.crowd; maxCrowdDraws = Math.max(maxCrowdDraws, crowd?.meshDrawCalls ?? 0); minSubmittedBodies = Math.min(minSubmittedBodies, crowd?.batches.reduce((n,b)=>n+b.instances,0) ?? 0); }
          }
          frames.sort((a,b) => a-b); sim.sort((a,b) => a-b);
          const state = a.getState(), perf = a.perf(); a.pause();
          return { minSubmittedBodies, backend: perf.backend, rendererTier: state.render.quality, cap: state.ai?.cap, count: state.ai?.count, p95: frames[Math.ceil(frames.length * .95)-1], p50: frames[Math.ceil(frames.length * .5)-1], simP95: sim[Math.ceil(sim.length*.95)-1], samples: frames.length, durationMs: performance.now()-start, ticks: a.tick()-startTick, renderedFrames: perf.renderedFrames-startRender, drawCalls: perf.drawCalls, maxDraws, maxCrowdDraws, triangles: perf.triangles, crowd: state.render.crowd, memory: perf.textures, recordedAt: new Date().toISOString() };
        });
        } finally { clearInterval(monitor); }
        if (overlappingBrowser) throw new Error('Concurrent browser detected: discard timing receipt and retry during an idle window');
        if (variant === 'after' && scene === 'L1') {
          const textured = await session.page.evaluate(() => window.__SS__!.query({ kind: 'infected' }).filter(e => e.health.current > 0 && e.appearance?.asset === 'inf.common-worker').length);
          if (!textured) throw new Error('L1 mix contains no textured common worker');
          await session.page.screenshot({path:resolve(reportDir, `L1-${backend}.png`)});
        }
        receipts.push({ variant, scene, ...result, errors: session.errors }); writeJson(report, receipts);
        console.log(JSON.stringify({ variant, scene, backend, p95: result.p95, count: result.count, crowdDraws: result.maxCrowdDraws, errors: session.errors.length }));
        if (session.errors.length || result.rendererTier !== 'low' || result.backend !== (backend === 'webgl2' ? 'webgl' : 'webgpu') || scene === 'crowd-200' && (result.count !== 200 || result.minSubmittedBodies !== 200 || result.maxCrowdDraws > 30)) throw new Error('Invalid performance receipt');
      }
    } finally { await session.close(); stopServer(); }
    // Wait for the owned preview listener to close before switching source roots.
    for (let i = 0; i < 20; i++) { try { await fetch(`http://127.0.0.1:${process.env.SCENE_PORT ?? 3341}`); await new Promise(r => setTimeout(r, 100)); } catch { break; } }
  }
  const median = (values: number[]) => { const sorted = values.slice().sort((a,b)=>a-b); return (sorted[Math.floor((sorted.length-1)/2)]+sorted[Math.ceil((sorted.length-1)/2)])/2; };
  const comparisons = ['webgl', 'webgpu'].flatMap(backend => ['crowd-200', 'L1'].map(scene => {
    const rows = receipts.filter(r => r.backend === backend && r.scene === scene);
    const before = median(rows.filter(r=>r.variant==='main').map(r=>r.p95)), after = median(rows.filter(r=>r.variant==='after').map(r=>r.p95));
    const ratio = after/before, deltaMs = after-before;
    return { backend, scene, before, after, ratio, deltaMs, draws: Math.max(...rows.filter(r=>r.variant==='after').map(r=>r.maxCrowdDraws)), passed: rows.length===4 && (scene==='crowd-200' ? ratio<=1.1 : deltaMs<=1) };
  }));
  writeJson(resolve(reportDir, 'performance-summary.json'),comparisons);
  console.log(JSON.stringify(comparisons));
  if (comparisons.some(c=>!c.passed)) throw new Error('Main/lane performance budget failed');
} finally { stopServer(); process.chdir(worktree); writeJson(report, receipts); }
