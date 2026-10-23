/** Q-126: cold production WebGPU/low/z1.5, real keys through the L1 delivery street and L2 boarding/departure. Quiet-run only. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';
const out = process.env.HITCH_OUT ?? 'test-results/fixes-13k/hitches';
mkdirSync(out, { recursive: true });
const results: unknown[] = []; let failed = false;
try {
  for (let repeat = 0; repeat < Number(process.env.HITCH_REPEATS ?? 3); repeat++) for (const level of ['L1', 'L2'] as const) {
    const session = new SceneSession({ backend: 'webgpu', tier: 'low', query: { test: 'poses', testApi: '1' }, viewport: { width: 1280, height: 720 } });
    const name = `${level}-${repeat + 1}`;
    try {
      await session.open();
      await session.page.evaluate('globalThis.__name = fn => fn');
      await session.page.evaluate(async level => {
        const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
        a.settings.set({ quality: 'low' }); await a.loadLevel(level, { seed: 1, ...(level === 'L2' ? { progression: 'L2-default' as const } : {}) });
        a.pause(); a.missions.begin(); a.cheats.god(true); a.debug.figureJoints(false);
        if (level === 'L1') {
          a.cheats.completeObjective('pickup');
          await a.step(1840);
          a.teleport(1, { x: 4.5, z: -32.7 });
        } else {
          a.cheats.completeObjective('axe');
          const board = g.world.missions!.def.anchors['l2-board']; a.teleport(1, board);
        }
        g.view.view.follow(); g.view.view.reset(a.getEntity(1)!.transform);
        g.view.view.zoom(Math.log(1.5 / g.view.view.getState().targetZoom), true); g.view.view.update(a.getEntity(1)!.transform, 1);
        (document.activeElement as HTMLElement | null)?.blur();
      }, level);
      const cdp = await session.page.context().newCDPSession(session.page);
      await cdp.send('Performance.enable'); await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start');
      const { metrics } = await cdp.send('Performance.getMetrics');
      const navigation = metrics.find(m => m.name === 'NavigationStart')!.value * 1000;
      const start = await session.page.evaluate(() => {
        const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
        const probe = { previous: 0, frames: [] as unknown[], builds: [] as unknown[], stopped: false };
        (window as unknown as { hitchProbe: typeof probe }).hitchProbe = probe;
        const onBuild = g.view.renderer.debug.onNodeBuilderCreated;
        g.view.renderer.debug.onNodeBuilderCreated = (builder, object) => {
          onBuild?.(builder, object);
          const draw = object as unknown as { object: import('three').Object3D; material: import('three').Material };
          const parents = []; for (let node = draw.object; node; node = node.parent!) parents.push(node.name);
          probe.builds.push({ at: performance.now(), tick: a.tick(), material: draw.material.name, parents });
        };
        const sample = (now: number) => {
          const p = a.perf();
          if (probe.previous) probe.frames.push({ at: now, ms: now - probe.previous, tick: a.tick(), position: { ...a.getEntity(1)!.transform }, sim: p.simMs, update: p.updateCpuMs, render: p.renderCpuMs, nodeBuilds: p.nodeBuilds });
          probe.previous = now; if (!probe.stopped) requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample); return performance.now();
      });
      const keys = level === 'L1' ? ['s', 'd'] : ['e'];
      for (const key of keys) await session.page.keyboard.down(key);
      await session.page.evaluate(() => window.__SS__!.resume());
      await session.page.waitForTimeout(level === 'L1' ? 5000 : 12000);
      for (const key of keys) await session.page.keyboard.up(key);
      const result = await session.page.evaluate(() => {
        const a = window.__SS__!, probe = (window as unknown as { hitchProbe: { stopped: boolean; frames: { ms: number; at: number; tick: number; position: { x: number; z: number } }[]; builds: unknown[] } }).hitchProbe;
        probe.stopped = true; a.pause();
        return { ...probe, perf: a.perf(), mission: a.missions.state(), player: a.getEntity(1)!.transform, max: Math.max(...probe.frames.map(f => f.ms)), over200: probe.frames.filter(f => f.ms > 200) };
      });
      const end = await session.page.evaluate(() => performance.now());
      const { profile } = await cdp.send('Profiler.stop');
      writeFileSync(`${out}/${name}.cpuprofile`, JSON.stringify({ ...profile, performanceStartedAt: start, performanceEndedAt: end, performanceNavigationStartMs: navigation }));
      writeFileSync(`${out}/${name}.json`, JSON.stringify(result, (key, value) => ['profileAssets', 'loadTiming', 'profile'].includes(key) ? undefined : value, 2));
      await session.page.screenshot({ path: `${out}/${name}.jpg`, type: 'jpeg', quality: 80 });
      const reached = level === 'L1' ? result.frames.some(f => f.position.x >= 9.5 && Math.abs(f.position.z + 32.7) < 2) && result.mission!.steps.deliver.status === 'active' : (result.mission!.l2?.departAt ?? 0) > 0;
      const row = { name, max: result.max, frames: result.frames.length, over200: result.over200, reached, builds: result.builds, backend: result.perf.backend, quality: result.perf.quality.tier, errors: session.errors };
      results.push(row); writeFileSync(`${out}/summary.json`, JSON.stringify(results, null, 2)); console.log(JSON.stringify(row));
      assert.equal(result.perf.backend, 'webgpu'); assert.equal(result.perf.quality.tier, 'low'); assert.ok(reached, `${name} must traverse the reported leg/ride event`);
      assert.deepEqual(session.errors, []); assert.deepEqual(result.over200, [], `${name}: no gameplay frame over 200 ms`);
    } catch (error) { failed = true; console.error(`${name}: ${String(error)}`); }
    finally { await session.close(); }
  }
} finally { stopServer(); }
process.exitCode = failed ? 1 : 0;
