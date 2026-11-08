/** Native Metal real-clock minute per tier; admission belongs to quiet-run.sh. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { loadavg } from 'node:os';
import { preset } from '../../src/sim/progression/Campaign';
import type { Game } from '../../src/Game';
import { SceneSession, stopServer } from '../scenelab/session';
import { provenance } from '../qa/accept/probe';
assert.equal(process.env.MI_PERF_LOCK_HELD, '1', 'Run through tools/perf/quiet-run.sh');
assert.ok(loadavg()[0] < 4, 'The requested 1-minute load must be below4 at admission');
const out = 'test-results/l6-visual/perf'; mkdirSync(out, { recursive: true });
const rows = [];
try {
  for (const tier of ['low', 'high'] as const) {
    const admissionLoad = loadavg();
    assert.ok(admissionLoad[0] < 4, `${tier}: shared host lost quiet admission`);
    const session = new SceneSession({ backend: 'webgpu', tier, viewport: { width: 1280, height: 720 }, query: { ui: '1', loadProfile: '2' } });
    try {
      await session.open();
      await session.page.addInitScript(`globalThis.__name = fn => fn; (() => {
        const request = navigator.gpu.requestAdapter;
        navigator.gpu.requestAdapter = function(...args) { return request.apply(this,args).then(adapter => {
          if (adapter) window.__l6Adapter = { architecture: adapter.info?.architecture, fallback: adapter.isFallbackAdapter ?? adapter.info?.isFallbackAdapter };
          return adapter;
        }); };
      })();`);
      await session.page.reload();
      await session.page.waitForFunction(() => !!window.__SS__, null, { timeout: 120000 });
      await session.page.evaluate(async () => { await window.__SS__!.ready; window.__SS__!.pause(); });
      const save = preset('L6-default'); save.settings.quality = tier;
      await session.page.evaluate(async ({ tier, save }) => {
        const a = window.__SS__!; a.settings.set({ quality: tier }); a.campaign.restore(save); await a.loadLevel('L6', { seed: 1 });
        a.pause(); a.camera.follow(); a.camera.zoom(1.5); a.cheats.god(false); a.input.clear();
      }, { tier, save });
      const cdp = await session.page.context().newCDPSession(session.page);
      await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 1000 });
      const performanceStartedAt = await session.page.evaluate(() => performance.now()); await cdp.send('Profiler.start');
      await session.page.evaluate(() => {
        const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
        const frames: { at: number; ms: number; tick: number; phase: string | undefined; sim: number; update: number; render: number; costs: Record<string, number> }[] = [];
        const builds: { at: number; tick: number; material: string; object: string; ms: number }[] = [];
        const longTasks: { startTime: number; duration: number }[] = [];
        const onBuild = g.view.renderer.debug.onNodeBuilderCreated;
        g.view.renderer.debug.onNodeBuilderCreated = (builder, value) => {
          onBuild?.(builder, value);
          const draw = value as unknown as { object: { name: string }; material: { name: string } };
          const row = { at: performance.now(), tick: a.tick(), material: draw.material.name, object: draw.object.name, ms: 0 }; builds.push(row);
          const measured = builder as unknown as { build(...args: unknown[]): unknown }, original = measured.build;
          measured.build = function (...args) { const at = performance.now(); try { return original.apply(this, args); } finally { row.ms += performance.now() - at; } };
        };
        const observer = new PerformanceObserver(list => { for (const e of list.getEntries()) longTasks.push({ startTime: e.startTime, duration: e.duration }); });
        observer.observe({ entryTypes: ['longtask'] });
        const p = { start: performance.now(), done: false, frames, builds, longTasks, resources: [] as unknown[], stop: () => { observer.disconnect(); } };
        (window as unknown as { l6Minute: typeof p }).l6Minute = p;
        let previous = p.start;
        const frame = (now: number) => {
          if (p.done) return;
          frames.push({ at: now, ms: now - previous, tick: a.tick(), phase: a.missions.state()?.phase, sim: g.simMs, update: g.view.updateCpuMs, render: g.view.renderCpuMs, costs: a.debug.cpuProfile() });
          previous = now; requestAnimationFrame(frame);
        };
        a.debug.cpuProfile(); a.missions.begin(); a.bot.start('complete'); a.resume(); requestAnimationFrame(frame);
      });
      const hostLoads: { elapsed: number; load: number[] }[] = [];
      const started = Date.now();
      while (Date.now() - started < 60_000) {
        const elapsed = Date.now() - started; hostLoads.push({ elapsed, load: loadavg() });
        await session.page.waitForTimeout(Math.min(1000, Math.max(1, 60_000 - elapsed)));
      }
      const result = await session.page.evaluate(() => {
        const a = window.__SS__!, p = (window as unknown as { l6Minute: { start: number; done: boolean; frames: unknown[]; builds: unknown[]; longTasks: unknown[]; stop(): void } }).l6Minute;
        p.done = true; a.pause(); a.bot.stop(); p.stop();
        return { adapter: (window as unknown as { __l6Adapter: { architecture: string; fallback: boolean } }).__l6Adapter, start: p.start, elapsedMs: performance.now() - p.start, frames: p.frames, builds: p.builds, longTasks: p.longTasks,
          resources: performance.getEntriesByType('resource').filter(e => e.startTime >= p.start).map(e => e.toJSON()), god: (window.__SCENE__ as unknown as { game: Game }).game.world.combat!.damage.god, backend: a.perf().backend, quality: a.getState().render.quality, mission: a.missions.state(), events: a.events(0), loadTiming: a.perf().loadTiming };
      });
      const profile = (await cdp.send('Profiler.stop')).profile; await cdp.detach();
      writeFileSync(`${out}/${tier}.cpuprofile.json.gz`, gzipSync(JSON.stringify({ ...profile, performanceStartedAt })));
      await session.page.screenshot({ path: `${out}/${tier}-end.png` });
      rows.push({ tier, admissionLoad, finalLoad: loadavg(), inputPolicy: 'complete', hostLoads, ...result, errors: session.errors });
      writeFileSync(`${out}/receipt.json`, JSON.stringify({ ...provenance(), method: 'Headless native Metal WebGPU, production preview, quiet-run admission, normal RAF clock for60s per tier. Ordinary mortal complete policy through the existing gameplay bot, with normal RAF input processing. No actor reposition, manual stepping or combat/stat changes during timing. Main-thread1ms CPU samples, native frame/sim/update/render/system costs, actual material builds, long tasks and resource timings retained for attribution.', rows }, null, 2) + '\n');
      const frames = result.frames as { ms: number; phase: string | undefined }[];
      console.log(JSON.stringify({ tier, elapsedMs: result.elapsedMs, frames: frames.length, maxMs: Math.max(...frames.map(f => f.ms)), over100: frames.filter(f => f.ms > 100).length, builds: result.builds, errors: session.errors }));
      assert.match(result.adapter.architecture, /^metal-/); assert.equal(result.adapter.fallback, false); assert.equal(result.backend, 'webgpu'); assert.equal(result.quality, tier); assert.ok(result.elapsedMs >= 60_000 && frames.length > 1000); assert.deepEqual(session.errors, []); assert.equal(result.god, false); assert.equal(result.mission?.phase, 'playing'); assert.equal(result.mission?.stats.deaths, 0); assert.ok(frames.every(f => f.phase === 'playing'), 'Both minutes must remain active gameplay');
    } finally { await session.close(); }
  }
} finally { stopServer(); }
