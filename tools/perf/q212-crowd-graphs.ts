/** Compare the ordinary crowd's graph census and retained live/corpse surfaces on two QA builds. */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { Mesh, Material } from 'three';
import type { Game } from '../../src/Game';
import { regularInfectedModels } from '../../src/data/crowdAppearance';
import type { SceneSpec } from '../../src/debug/scenelab/spec';
import { SceneSession, stopServer } from '../scenelab/session';

const [out] = process.argv.slice(2);
assert.ok(out, 'pass an output directory; select the QA preview with SCENE_PORT/SCENE_DIST');
mkdirSync(out, { recursive: true });
const spec = JSON.parse(readFileSync('specs/scenes/catalog/inf-horde-headwear.json', 'utf8')) as SceneSpec;
assert.ok(spec.actors, 'the comparison fixture must declare its actors');
// A separated version distinguishes surface changes from depth ties in the dense corpse pile.
if (process.env.Q212_SPACED_SURFACES === '1') {
  const infected = spec.actors.filter(actor => actor.kind === 'infected').slice(0, 7);
  const positions: [number, number][] = [[-4, -4], [0, -4], [4, -4], [-4, 0], [0, 0], [4, 0], [0, 4]];
  infected.forEach((actor, index) => { actor.at = positions[index]; });
  spec.actors = [...spec.actors.filter(actor => actor.kind === 'courier'), ...infected];
}
const expectedBodies = spec.actors.filter(actor => actor.kind === 'infected').length;
try {
  for (const backend of ['webgpu', 'webgl2'] as const) for (const tier of ['high', 'low'] as const) {
    const session = new SceneSession({ backend, tier, viewport: { width: 960, height: 540 }, query: { loadProfile: '2', crowdProbe: 'drawn' } });
    try {
      await session.open();
      await session.page.evaluate('window.__name = fn => fn');
      const census = await session.page.evaluate(async ({ models, tier }) => {
        const a = window.__SS__!;
        a.settings.set({ quality: tier });
        const initialBuilds = a.perf().nodeBuilds;
        await a.loadLevel('L7', { seed: 1, progression: 'L7-default' }); a.pause();
        const game = (window.__SCENE__ as unknown as { game: Game }).game;
        const crowd = (game.view as unknown as { crowd: { batches: Map<string, { asset: string; lod: string; mesh: Mesh }> } }).crowd;
        const batches = [...crowd.batches].filter(([, batch]) => models.includes(batch.asset)).map(([key, batch]) => ({
          key, asset: batch.asset, lod: batch.lod, material: (batch.mesh.material as Material).uuid,
          vertices: batch.mesh.geometry.getAttribute('position').count, indices: batch.mesh.geometry.index?.count ?? 0,
        }));
        return { backend: a.perf().backend, tier: a.perf().quality.tier, nodeBuilds: a.perf().nodeBuilds - initialBuilds, batches, materials: new Set(batches.map(batch => batch.material)).size };
      }, { models: [...regularInfectedModels] as string[], tier });
      assert.equal(census.backend, backend === 'webgpu' ? 'webgpu' : 'webgl');
      assert.equal(census.tier, tier);
      await session.load(spec);
      const fixtureLoadedBuilds = await session.page.evaluate(() => window.__SS__!.perf().nodeBuilds);
      await session.step(30);
      await session.screenshot(`${out}/${backend}-${tier}-live.png`);
      const bodies = await session.page.evaluate(async () => {
        const a = window.__SS__!; a.pause(); a.cheats.killAll();
        const state = () => a.query({ kind: 'infected' }).map(entity => ({ id: entity.id, health: entity.health.current, transform: entity.transform, model: entity.infected?.model }));
        await a.step(180); const settled = state();
        await a.step(1800); await a.screenshotReady();
        return { settled, retained: state(), layout: a.debug.corpseLayout(), nodeBuildsAfter: a.perf().nodeBuilds };
      });
      await session.screenshot(`${out}/${backend}-${tier}-corpses.png`);
      const fixtureLateBuilds = bodies.nodeBuildsAfter - fixtureLoadedBuilds;
      writeFileSync(`${out}/${backend}-${tier}.json`, JSON.stringify({ backend, tier, census, bodies, fixtureLoadedBuilds, fixtureLateBuilds, errors: session.errors }, null, 2));
      assert.deepEqual(session.errors, []);
      assert.equal(bodies.retained.length, expectedBodies);
      assert.ok(bodies.retained.every(body => body.health === 0));
      assert.deepEqual(bodies.retained, bodies.settled, 'all corpse identities and roots must persist for another 30 seconds');
      assert.equal(fixtureLateBuilds, 0, 'live and frozen surfaces must use the loaded graphs');
      console.log(JSON.stringify({ backend, tier, nodeBuilds: census.nodeBuilds, ordinaryBatches: census.batches.length, ordinaryMaterials: census.materials, bodies: bodies.retained.length, fixtureLateBuilds }));
    } finally { await session.close(); }
  }
} finally { stopServer(); }
