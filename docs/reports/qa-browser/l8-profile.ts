/** Whole L8 real-clock matrix, one headless browser at a time. No screenshots or raw traces. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Game } from '../../../src/Game';
import type { CampaignSave } from '../../../src/sim/progression/Campaign';
import { SceneSession, stopServer } from '../../../tools/scenelab/session';

assert.equal(process.env.MI_PERF_LOCK_HELD, '1', 'Use tools/perf/quiet-run.sh');
const campaign = JSON.parse(await readFile(process.env.L8_PROFILE_CAMPAIGN!, 'utf8')) as CampaignSave;
const out = process.argv[2] ?? 'docs/reports/qa-browser/l8-performance.json';
await mkdir(dirname(out), { recursive: true });
const results = process.env.L8_PROFILE_APPEND==='1' ? JSON.parse(await readFile(out,'utf8')) : [];
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
try {
  for (const tier of ['low', 'high'] as const) {
    if(process.env.L8_PROFILE_TIER&&process.env.L8_PROFILE_TIER!==tier)continue;
    const session = new SceneSession({ backend: 'webgpu', tier, query: { crowdProbe: 'drawn',ui:'1' } });
    try {
      await session.open();
      await session.page.evaluate(async ({ campaign, tier }) => {
        const a = window.__SS__!; a.settings.set({ quality: tier }); a.campaign.restore(campaign);
        await a.loadLevel('L8', { seed: 1 }); a.pause();a.settings.set({quality:tier});await a.screenshotReady();a.missions.begin();
        document.documentElement.dataset.sceneHud='1';document.querySelectorAll('#hud,.hud').forEach(n=>n.setAttribute('data-scene-hud',''));a.camera.follow(); a.camera.zoom(1.5); a.debug.figureJoints(false); a.bot.start('complete');
        const g = (window.__SCENE__ as unknown as { game: Game }).game;
        // Per-object draw attribution is disabled during timing; aggregate renderer counters remain available.
        g.view.renderer.profile = null; g.view.renderer.profileAssets = null;
      }, { campaign, tier });
      const result = await session.page.evaluate(async () => {
        const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
        const windows: Record<string, unknown>[] = [];
        const ui:number[]=[],owed:number[]=[],scales:number[]=[],normalFrames:number[]=[],slowFrames:number[]=[];
        const frames: number[] = [], ticks: number[] = [], sims: number[] = [], updates: number[] = [], renders: number[] = [];
        let start = performance.now(), startTick = g.world.tick, nextTick = 3600, previous = start;
        const deadline = start + 260_000;
        const stats = (v: number[]) => { const x = v.slice().sort((a, b) => a - b); return { count: x.length, p50: x[Math.floor(x.length * .5)] ?? 0, p95: x[Math.ceil(x.length * .95) - 1] ?? 0, max: x.at(-1) ?? 0 }; };
        const capture = (now: number) => {
          const p = a.perf(), entities = [...g.world.entities.iterate()];
          windows.push({ tick: g.world.tick, wallSeconds: (now - start) / 1000,
            simSecondsPerWallSecond: (g.world.tick - startTick) / 60 / ((now - start) / 1000),
            frames: stats(frames),normalFrames:stats(normalFrames),slowMotionFrames:stats(slowFrames),uiCpuMs:stats(ui),owedTicks:stats(owed),timeScale:stats(scales),simTickMs: stats(ticks), simFrameMs: stats(sims), updateCpuMs: stats(updates), renderCpuMs: stats(renders),
            drawCalls: p.drawCalls, triangles: p.triangles, backend: p.backend, quality: p.quality,
            liveInfected: g.world.infected!.active.filter(e => e.health.current > 0).length, directorSlots: g.world.infected!.director.count, corpses: entities.filter(e => !!e.corpse).length,
            followers: g.world.missions!.l8?.roster().length??null,scenario:g.world.scenario,god:g.world.combat!.damage.god, drawnCharacters: a.crowdFigures().filter(f => f.drawn).length,
            barMeshes:g.view.healthBars?.snapshot().draws??null,geometries:p.geometries,textures:p.textures,effects:p.effects,nodeBuilds:p.nodeBuilds,nodeBuildMaterials:p.nodeBuildMaterials,audio:a.audio.snapshot(),player:{...g.world.entities.get(1)!.transform},
            bars: (g.view as unknown as { healthBars?: { count: number } }).healthBars?.count ?? 0,
            heapBytes: p.heapBytes, phase: g.world.missions!.state.phase, checkpoint: g.world.missions!.state.checkpoint });
          for (const array of [frames, ticks, sims, updates, renders,ui,owed,scales,normalFrames,slowFrames]) array.length = 0;
          start = now; startTick = g.world.tick;
        };
        a.resume();
        while (g.world.scenario==='L8' && g.world.missions!.state.phase === 'playing' && performance.now() < deadline) {
          const now = await new Promise<number>(requestAnimationFrame);
          const frame=now-previous;frames.push(frame);(g.clock.timeScale<.999?slowFrames:normalFrames).push(frame);ui.push(g.ui.updateMs);owed.push(g.clock.deferred);scales.push(g.clock.timeScale);previous = now; ticks.push(g.simTickMs); sims.push(g.simMs); updates.push(g.view.updateCpuMs); renders.push(g.view.renderCpuMs);
          if (g.world.tick >= nextTick) { capture(now); nextTick += 3600; }
        }
        if (frames.length) capture(performance.now()); a.pause(); a.bot.stop();
        return {end:{scenario:g.world.scenario,phase:g.world.missions!.state.phase,checkpoint:g.world.missions!.state.checkpoint,stats:{...g.world.missions!.state.stats}}, complete: g.world.scenario==='L9'||g.world.missions!.state.phase === 'progression', tick: g.world.tick, windows };
      });
      results.push({ tier, seed: 1, zoom: 1.5, sourceCommit, at: new Date().toISOString(), campaignLabel:'Real physical L7 high seed-1 handover, 23 survivors. This is not the missing batch59 production payload or a constructed 50-follower stress save.', buildMode: process.env.SCENE_SERVER === 'preview' ? 'preview' : 'dev', ...result, errors: session.errors });
      await writeFile(out, JSON.stringify(results, null, 2));
      assert.deepEqual(session.errors, []);assert(result.windows.every(w=>(w.quality as {tier:string}).tier===tier),'Actual quality differs from requested tier');assert(result.windows.every(w=>w.god===false),'Mortal run required');
    } finally { await session.close(); }
  }
} finally { stopServer(); }
