/** Quiet, unprofiled first-handgun and shutter intervals, without photo/pose preparation. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { launchBrowser } from '../browser-pool/client';
import type { Game } from '../../src/Game';

assert.equal(process.env.MI_PERF_LOCK_HELD, '1', 'Use tools/perf/quiet-run.sh');
const tier = process.argv[2] ?? 'low';
assert(tier === 'low' || tier === 'high');
const levels = (process.argv[3] ?? 'L1,L3').split(',');
assert(levels.every(level => level === 'L1' || level === 'L3'));
const checkpoint = process.argv[4] ?? 'bat';
assert(checkpoint === 'bat' || checkpoint === 'accident');
const out = process.env.FIX51_MOMENTS_OUT ?? 'test-results/fix51-perfmeasure/moments';
mkdirSync(out, { recursive: true });
const rows = [];
const browser = await launchBrowser({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu'] });
try {
  for (const level of levels) for (const [side, origin] of [['prod', 'http://127.0.0.1:4902'], ['candidate', 'http://127.0.0.1:4901']]) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    const page = await context.newPage(), errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    try {
      await page.addInitScript('window.__name = f => f');
      // Match the release matrix; test=1 deliberately bypasses the five-second
      // background-preparation delay and can conceal an early streaming hitch.
      await page.goto(`${origin}/?test=poses&testApi=1&scenelab=1&profile=1&preload=0&dpr=1&quality=${tier}&audio=muted&seed=1`);
      await page.waitForFunction(() => !!window.__SS__ && !!window.__SCENE__, null, { timeout: 120_000 });
      await page.evaluate(async ({ level, tier, checkpoint }: { level: string; tier: 'low' | 'high'; checkpoint: 'bat' | 'accident' }) => {
        const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
        await a.ready; a.pause(); a.settings.set({ quality: tier });
        await a.loadLevel(level, { seed: 1, ...(level === 'L1' ? { checkpoint } : {}) });
        a.pause(); a.missions.begin(); a.cheats.god(true); a.camera.follow(); a.camera.zoom(1.5); g.ui.show(null);
      }, { level, tier: tier as 'low' | 'high', checkpoint: checkpoint as 'bat' | 'accident' });
      const result = await page.evaluate(async () => {
        const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
        const scenario = g.world.scenario, builds: { at: number; tick: number; material: string }[] = [];
        const frames: { at: number; ms: number; tick: number; shutter: boolean; station: string | undefined; sim: number; update: number; render: number }[] = [];
        const onBuild = g.view.renderer.debug.onNodeBuilderCreated;
        const start = performance.now();
        g.view.renderer.debug.onNodeBuilderCreated = (builder, object) => {
          onBuild?.(builder, object);
          const draw = object as unknown as { material: { name: string } };
          builds.push({ at: performance.now() - start, tick: a.tick(), material: draw.material.name });
        };
        const startTick = a.tick(); let last = start, shutterAt = 0;
        a.bot.start('complete'); a.resume();
        while (performance.now() - start < 60_000) {
          const now = await new Promise<number>(requestAnimationFrame);
          if ((g as unknown as { loading: boolean }).loading || g.world.scenario !== scenario || !['playing', 'cinematic', ...(scenario === 'L1' ? ['result'] : [])].includes(g.world.missions!.state.phase)) break;
          const state = a.missions.state()!;
          if (state.gates['fire-shutter'] === false && !shutterAt) shutterAt = now;
          frames.push({ at: now - start, ms: now - last, tick: a.tick(), shutter: state.gates['fire-shutter'] === false,
            station: state.l3?.phase, sim: g.simMs, update: g.view.updateCpuMs, render: g.view.renderCpuMs });
          last = now;
          if (shutterAt && now - shutterAt >= 2000) break;
        }
        a.pause(); a.bot.stop();
        const sorted = frames.map(f => f.ms).sort((a, b) => a - b);
        return { diagnostic: false, scenario, startTick, durationMs: last - start, backend: a.perf().backend, quality: a.getState().render.quality,
          frames, builds, p95Ms: sorted[Math.ceil(sorted.length * .95) - 1], maxMs: sorted.at(-1), state: a.missions.state(),
          events: a.events(startTick).filter(e => /^(?:objective\.|pickup\.|combat\.attack|story\.)/.test(e.type)) };
      });
      rows.push({ side, level, tier, testQuery: 'poses', checkpoint: level === 'L1' ? checkpoint : null, measuredAt: new Date().toISOString(), ...result, errors });
      writeFileSync(`${out}/${tier}${levels.length === 1 ? `-${levels[0]}` : ''}.json`, JSON.stringify(rows, null, 2) + '\n');
      console.log(JSON.stringify({ side, level, tier, durationMs: result.durationMs, maxMs: result.maxMs, errors }));
      assert.equal(result.backend, 'webgpu'); assert.equal(result.quality, tier); assert.deepEqual(errors, []);
      if (level === 'L1') assert(result.frames.some(f => f.shutter), 'Shutter closure must lie inside the measured interval');
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
