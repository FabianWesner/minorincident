/** Whole L8 real-clock matrix, one headless browser at a time. No screenshots or raw traces. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Game } from '../../src/Game';
import type { CampaignSave } from '../../src/sim/progression/Campaign';
import { SceneSession, stopServer } from '../scenelab/session';

assert.equal(process.env.MI_PERF_LOCK_HELD, '1', 'Use tools/perf/quiet-run.sh');
const campaign = JSON.parse(await readFile(process.env.L8_PROFILE_CAMPAIGN!, 'utf8')) as CampaignSave;
const out = process.argv[2] ?? 'docs/reports/r12-l8perf/browser.json';
await mkdir(dirname(out), { recursive: true });
const results = [];
try {
  for (const tier of ['low', 'high'] as const) {
    const session = new SceneSession({ backend: 'webgpu', tier, query: { crowdProbe: 'drawn' } });
    try {
      await session.open();
      await session.page.evaluate(async ({ campaign, tier }) => {
        const a = window.__SS__!; a.settings.set({ quality: tier }); a.campaign.restore(campaign);
        await a.loadLevel('L8', { seed: 1 }); a.pause(); a.missions.begin();
        a.camera.follow(); a.camera.zoom(1.5); a.debug.figureJoints(false); a.bot.start('complete');
        const g = (window.__SCENE__ as unknown as { game: Game }).game;
        // Per-object draw attribution is disabled during timing; aggregate renderer counters remain available.
        g.view.renderer.profile = null; g.view.renderer.profileAssets = null;
      }, { campaign, tier });
      const result = await session.page.evaluate(async () => {
        const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
        const windows = [], frames: number[] = [], ticks: number[] = [], sims: number[] = [], updates: number[] = [], renders: number[] = [];
        let start = performance.now(), startTick = g.world.tick, nextTick = 3600, previous = start;
        const deadline = start + 260_000;
        const stats = (v: number[]) => { const x = v.slice().sort((a, b) => a - b); return { count: x.length, p50: x[Math.floor(x.length * .5)] ?? 0, p95: x[Math.ceil(x.length * .95) - 1] ?? 0, max: x.at(-1) ?? 0 }; };
        const capture = (now: number) => {
          const p = a.perf(), entities = [...g.world.entities.iterate()];
          windows.push({ tick: g.world.tick, wallSeconds: (now - start) / 1000,
            simSecondsPerWallSecond: (g.world.tick - startTick) / 60 / ((now - start) / 1000),
            frames: stats(frames), simTickMs: stats(ticks), simFrameMs: stats(sims), updateCpuMs: stats(updates), renderCpuMs: stats(renders),
            drawCalls: p.drawCalls, triangles: p.triangles, backend: p.backend, quality: p.quality,
            liveInfected: g.world.infected!.director.count, corpses: entities.filter(e => !!e.corpse).length,
            followers: g.world.missions!.l8!.roster().length, drawnCharacters: a.crowdFigures().filter(f => f.drawn).length,
            bars: (g.view as unknown as { healthBars?: { count: number } }).healthBars?.count ?? 0,
            heapBytes: p.heapBytes, phase: g.world.missions!.state.phase, checkpoint: g.world.missions!.state.checkpoint });
          for (const array of [frames, ticks, sims, updates, renders]) array.length = 0;
          start = now; startTick = g.world.tick;
        };
        a.resume();
        while (g.world.missions!.state.phase === 'playing' && performance.now() < deadline) {
          const now = await new Promise<number>(requestAnimationFrame), p = a.perf();
          frames.push(now - previous); previous = now; ticks.push(p.simTickMs); sims.push(p.simMs); updates.push(p.updateCpuMs); renders.push(p.renderCpuMs);
          if (g.world.tick >= nextTick) { capture(now); nextTick += 3600; }
        }
        if (frames.length) capture(performance.now()); a.pause(); a.bot.stop();
        return { complete: g.world.missions!.state.phase === 'progression', tick: g.world.tick, windows };
      });
      results.push({ tier, seed: 1, zoom: 1.5, buildMode: process.env.SCENE_SERVER === 'preview' ? 'preview' : 'dev', ...result, errors: session.errors });
      await writeFile(out, JSON.stringify(results, null, 2));
      assert.deepEqual(session.errors, []);
    } finally { await session.close(); }
  }
} finally { stopServer(); }
