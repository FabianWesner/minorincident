/** Single-context CPU/material attribution on the sampled native routes.
 * Diagnostic only; frame acceptance requires an orchestrator quiet window.
 */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { SceneSession, stopServer } from '../scenelab/session';
import { prepareStop, tour } from '../qa/ab-tour';
import { preset } from '../../src/sim/progression/Campaign';
import { cure } from '../../src/levels/L10/district';
import type { Game } from '../../src/Game';

const [level = 'L10', tier = 'high'] = process.argv.slice(2);
assert(['L1', 'L3', 'L7', 'L10'].includes(level)); assert(tier === 'low' || tier === 'high');
const out = process.env.FIX51_ROUTE_OUT ?? `test-results/fix51-perf/route-${level}-${tier}`;
mkdirSync(out, { recursive: true });
const session = new SceneSession({ backend: 'webgpu', tier, viewport: { width: 1280, height: 720 }, query: { loadProfile: '2', ui: '1' } });
try {
  await session.open(); await session.page.evaluate('window.__name = f => f');
  if (level === 'L10') {
    const stop = tour.find(s => s.id === 'l10-finale')!, target = cure.anchors['cure-disperse-ready'];
    const save = preset('L10-default'); save.settings.quality = tier;
    const walkRoute = [...cure.regions.flatMap(r => r.route), target].map(p => [...p]);
    const setup: Parameters<typeof prepareStop>[0] = { stop, seed: 1, save, zoom: 1.5, tier, walkRoute };
    await session.page.evaluate(prepareStop, setup);
  } else await session.page.evaluate(async ({ level, tier }: { level: string; tier: 'low' | 'high' }) => {
    const a = window.__SS__!;
    a.settings.set({ quality: tier });
    await a.loadLevel(level, { seed: 1, checkpoint: level === 'L1' ? 'bat' : undefined });
    a.pause(); a.missions.begin(); a.cheats.god(true); a.camera.follow(); a.camera.zoom(1.5);
    if (level === 'L7') {
      const g = (window.__SCENE__ as unknown as { game: Game }).game;
      a.bot.start('complete');
      for (let i = 0; i < 150 && !g.world.l7Encounters!.state.started; i++) await a.step(120);
      a.bot.stop(); a.input.clear();
      if (!g.world.l7Encounters!.state.started) throw Error('Native L7 fight was not reached');
      await a.screenshotReady();
    }
  }, { level, tier: tier as 'low' | 'high' });
  const cdp = await session.page.context().newCDPSession(session.page);
  await cdp.send('Profiler.enable');
  const performanceStartedAt = await session.page.evaluate(() => performance.now());
  await cdp.send('Profiler.start');
  const result = await session.page.evaluate(async () => {
    const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
    const builds: { at: number; tick: number; material: string; object: string; parents: string[]; materialId: number; context: number; key: number; ms: number }[] = [];
    const frames: { at: number; ms: number; tick: number; sim: number; update: number; render: number; charge: number; objective: string | null; costs: Record<string, number> }[] = [];
    const onBuild = g.view.renderer.debug.onNodeBuilderCreated;
    g.view.renderer.debug.onNodeBuilderCreated = (builder, value) => {
      onBuild?.(builder, value);
      const draw = value as unknown as { object: import('three').Object3D; material: { name: string; type: string; id: number }; context: { id: number }; getMaterialCacheKey(): number };
      const parents: string[] = [];
      for (let node: import('three').Object3D | null = draw.object; node; node = node.parent) parents.push(`${node.name || node.type}${node.userData.assetId ? `:${node.userData.assetId}` : ''}`);
      const row = { at: performance.now(), tick: a.tick(), material: draw.material.name, object: draw.object.name, materialId: draw.material.id,
        parents, context: draw.context.id, key: draw.getMaterialCacheKey(), ms: 0 }; builds.push(row);
      const measured = builder as unknown as { build(...args: unknown[]): unknown }, build = measured.build;
      measured.build = function (...args) { const at = performance.now(); try { return build.apply(this, args); } finally { row.ms += performance.now() - at; } };
    };
    a.debug.cpuProfile(); a.bot.start('complete'); a.resume();
    const start = performance.now(); let last = start;
    while (performance.now() - start < 60_000 && !(g as unknown as { loading: boolean }).loading && g.world.missions?.state.phase === 'playing') {
      const now = await new Promise<number>(requestAnimationFrame);
      frames.push({ at: now, ms: now - last, tick: a.tick(), sim: g.simMs, update: g.view.updateCpuMs, render: g.view.renderCpuMs,
        charge: a.missions.state()!.counters['charge-ticks'] ?? 0, objective: document.querySelector('[data-testid=objective-text]')?.textContent ?? null, costs: a.debug.cpuProfile() });
      last = now;
    }
    a.pause(); a.bot.stop();
    return { diagnostic: true, backend: a.perf().backend, quality: a.getState().render.quality, start, frames, builds,
      state: a.missions.state(), events: a.events(0).filter(e => e.type.startsWith('objective.') || e.type === 'combat.attack' || e.type === 'pickup.collected'), loadTiming: a.perf().loadTiming };
  });
  const profile = (await cdp.send('Profiler.stop')).profile;
  writeFileSync(`${out}/route.cpuprofile.gz`, gzipSync(JSON.stringify({ ...profile, performanceStartedAt })));
  writeFileSync(`${out}/route.json`, JSON.stringify({ ...result, errors: session.errors }, null, 2) + '\n');
  console.log(JSON.stringify({ diagnostic: true, level, tier, frames: result.frames.length, builds: result.builds, spikes: result.frames.filter(f => f.ms >= 50), errors: session.errors }));
  assert.equal(result.backend, 'webgpu'); assert.equal(result.quality, tier); assert.deepEqual(session.errors, []);
  await cdp.detach();
} finally { await session.close(); stopServer(); }
