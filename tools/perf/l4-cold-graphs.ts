/** Auxiliary shader-identity trace, with no frame-budget claim. The unchanged
 * l4-budgets.spec.ts remains the native acceptance measurement.
 * SCENE_SERVER=preview E2E_UNITS=1 sh tools/e2e-lock.sh npx tsx tools/perf/l4-cold-graphs.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import type { Game } from '../../src/Game';
import { SceneSession, stopServer } from '../scenelab/session';

const remote = process.platform !== 'darwin' && process.env.MI_REMOTE === '1' && process.env.E2E_UNITS === '1';
if (process.env.MI_PERF_LOCK_HELD !== '1' && !remote) throw Error('Use quiet-run locally, or the single-browser remote wrapper');
const selectedTier = process.env.L4_GRAPH_TIER ?? 'high';
if (selectedTier !== 'high' && selectedTier !== 'low') throw Error('Invalid tier');
const tier: 'high' | 'low' = selectedTier;
const out = process.env.L4_GRAPH_OUT ?? 'test-results/perf-l4-l6/l4-graphs';
mkdirSync(out, { recursive: true });
const session = new SceneSession({ backend: 'webgl2', tier, phone: tier === 'low', seed: 2, viewport: tier === 'low' ? { width: 390, height: 844 } : { width: 1600, height: 900 }, query: { loadProfile: '2', dpr: tier === 'high' ? '1' : '1.5' } });
try {
  await session.open();
  await session.page.evaluate('globalThis.__name = fn => fn');
  const trace = await session.page.evaluate(async ({ tier, full }: { tier: 'high' | 'low'; full: boolean }) => {
    const a = window.__SS__!, game = (window.__SCENE__ as unknown as { game: Game }).game;
    a.settings.set({ quality: tier });
    performance.clearMeasures(); const loadStarted = performance.now();
    await a.loadLevel('L4', { seed: 2, progression: 'L4-default' });
    const loadMs = performance.now() - loadStarted, loadPhases = performance.getEntriesByType('measure').map(entry => ({ name: entry.name, ms: entry.duration })); a.pause(); a.missions.begin(); a.cheats.god(true); a.bot.start('complete');
    const builds: unknown[] = [], renderer = game.view.renderer, before = renderer.nodeBuilds;
    const onBuild = renderer.debug.onNodeBuilderCreated;
    const describe = (material: import('three').Material) => Object.fromEntries(Object.entries(material).filter(([key, value]) => !key.startsWith('_') && value?.isNode).map(([key, value]) => [key, { id: value.id, key: value.getCacheKey() }]));
    const initialMaterials: unknown[] = [];
    game.view.scene.traverse(object => { if ('material' in object) for (const material of Array.isArray(object.material) ? object.material : [object.material]) initialMaterials.push({ object: object.name, material: material.name, id: material.id, program: material.customProgramCacheKey(), nodes: describe(material) }); });
    renderer.debug.onNodeBuilderCreated = (builder, value) => {
      onBuild?.(builder, value);
      const draw = value as unknown as { object: import('three').Object3D & { count?: number; geometry?: import('three').BufferGeometry }; material: import('three').Material & { id: number; outputNode?: { id: number } }; getMaterialCacheKey(): number; getDynamicCacheKey(): number; getGeometryCacheKey(): string; context: { id: number } };
      const parents: string[] = [];
      for (let node: import('three').Object3D | null = draw.object; node; node = node.parent) parents.push(`${node.name || node.type}${node.userData.assetId ? `:${node.userData.assetId}` : ''}`);
      builds.push({ tick: a.tick(), phase: a.missions.state()!.l4!.phase, object: draw.object.name, parents, material: draw.material.name || draw.material.type, materialId: draw.material.id, outputNode: draw.material.outputNode?.id, materialKey: draw.getMaterialCacheKey(), program: draw.material.customProgramCacheKey(), nodes: describe(draw.material), geometryKey: draw.getGeometryCacheKey(), context: draw.context.id, dynamicKey: draw.getDynamicCacheKey(), lightState: (game.view as unknown as { scene: import('three').Scene }).scene.userData.shadowVariant, weatherMode: (game.view as unknown as { lighting?: { weatherMode: number } }).lighting?.weatherMode, count: draw.object.count, attributes: Object.fromEntries(Object.entries(draw.object.geometry?.attributes ?? {}).map(([name, attribute]) => [name, attribute.itemSize])) });
    };
    try {
      for (let i = 0; i < 800 && a.missions.state()!.l4!.phase !== 'plaza'; i++) await a.step(15);
      for (let i = 0; i < 1200 && !a.missions.state()!.l4!.gunAt; i++) await a.step(1);
      for (let i = 0; i < 300 && !a.missions.state()!.l4!.turnAt; i++) await a.step(1);
      if (!a.missions.state()!.l4!.turnAt) throw Error('The ordinary bot did not reach the alarm');
      for (let i = 0; i < 120; i++) await a.step(1);
      await a.screenshotReady();
      if (full) {
        for (let i = 0; i < 1400 && !a.missions.state()!.l4!.lineBreakAt; i++) await a.step(15);
        if (!a.missions.state()!.l4!.lineBreakAt) throw Error('The ordinary bot did not reach line break');
        await a.step(120); await a.screenshotReady();
      }
      return { diagnostic: true, loadMs, loadPhases, backend: a.perf().backend, tier: a.perf().quality.tier, turnAt: a.missions.state()!.l4!.turnAt, newBuilds: renderer.nodeBuilds - before, builds, initialMaterials, materials: a.perf().nodeBuildMaterials };
    } finally { renderer.debug.onNodeBuilderCreated = onBuild; a.bot.stop(); }
  }, { tier, full: process.env.L4_GRAPH_FULL === '1' });
  writeFileSync(`${out}/${tier}.json`, JSON.stringify(trace, null, 2));
  console.log(JSON.stringify(trace));
  if (session.errors.length) throw Error(session.errors.join('\n'));
} finally { await session.close(); stopServer(); }
