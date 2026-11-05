/** Diagnostic load attribution; timings are proxies until repeated in an orchestrator quiet window.
 * SCENE_PORT=4437 sh tools/e2e-lock.sh npx tsx tools/perf/load-phase-profile.ts L5 high webgpu
 */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { SceneSession, stopServer, type Backend } from '../scenelab/session';
import type { Game } from '../../src/Game';

const [level = 'L5', tier = 'high', backend = 'webgpu'] = process.argv.slice(2);
assert(/^L(?:[1-9]|10)$/.test(level));
assert(tier === 'low' || tier === 'high');
assert(backend === 'webgpu' || backend === 'webgl2');
const out = process.env.LOAD_PHASE_OUT ?? `test-results/fix51-perf/${level}-${tier}-${backend}`;
mkdirSync(out, { recursive: true });
const session = new SceneSession({ backend: backend as Backend, tier, viewport: { width: 1280, height: 720 }, query: { loadProfile: '2' } });
try {
  await session.open();
  const cdp = await session.page.context().newCDPSession(session.page);
  await cdp.send('Profiler.enable');
  const performanceStartedAt = await session.page.evaluate(() => performance.now());
  await cdp.send('Profiler.start');
  const result = await session.page.evaluate(async level => {
    const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
    const builds: { at: number; ms: number; material: string; object: string; owner?: string; materialKey: string; renderKey?: number }[] = [];
    const onBuild = g.view.renderer.debug.onNodeBuilderCreated;
    g.view.renderer.debug.onNodeBuilderCreated = (builder, object) => {
      onBuild?.(builder, object);
      const draw = object as { material: { name: string; customProgramCacheKey(): string }; getCacheKey?(): number; object: { name: string; type: string; parent?: { model?: string; lod?: string } } };
      const row = { at: performance.now(), ms: 0, material: draw.material.name, object: draw.object.name || draw.object.type,
        owner: draw.object.parent?.model && `${draw.object.parent.model}:${draw.object.parent.lod}`, materialKey: draw.material.customProgramCacheKey(), renderKey: draw.getCacheKey?.() };
      builds.push(row);
      const measured = builder as unknown as { build(...args: unknown[]): unknown };
      const build = measured.build;
      measured.build = function (...args) { const start = performance.now(); try { return build.apply(this, args); } finally { row.ms += performance.now() - start; } };
    };
    performance.clearMeasures();
    const start = performance.now();
    await a.loadLevel(level, { seed: 1 }); a.pause();
    return { diagnostic: true, level, wallMs: performance.now() - start, builds,
      backend: a.perf().backend, quality: a.getState().render.quality,
      population: [...g.world.entities.iterate()].filter(e => e.infected && e.health.current > 0 && !e.hidden).length,
      measures: performance.getEntriesByType('measure').map(e => ({ name: e.name, start: e.startTime, ms: e.duration, detail: (e as PerformanceMeasure).detail })),
      crowdPreparation: a.perf().crowdPreparation, loadTiming: a.perf().loadTiming };
  }, level);
  const profile = (await cdp.send('Profiler.stop')).profile;
  writeFileSync(`${out}/load.cpuprofile.gz`, gzipSync(JSON.stringify({ ...profile, performanceStartedAt })));
  writeFileSync(`${out}/load.json`, JSON.stringify({ ...result, errors: session.errors }, null, 2) + '\n');
  console.log(JSON.stringify({ ...result, builds: result.builds.length }));
  assert.equal(result.backend, backend === 'webgl2' ? 'webgl' : backend);
  assert.equal(result.quality, tier); assert.deepEqual(session.errors, []);
  await cdp.detach();
} finally { await session.close(); stopServer(); }
