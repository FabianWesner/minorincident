/** Door-preserving wreck/burn review at each tier in the real game renderer. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from './session';
const out = process.argv[2] ?? 'docs/reports/engine-wreck-doors/captures';
const session = new SceneSession({ viewport: { width: 1600, height: 900 } });
const metrics: unknown[] = [];
mkdirSync(out, { recursive: true });
try {
  await session.open();
  await session.load({ name: 'registry-setup', ground: 'asphalt', size: 30,
    vehicles: [{ id: 'engine', asset: 'vehicle.fire-engine', at: [0, 0] }] });
  // Pin only the engine's asset tier; camera, lighting and all other game content stay real.
  await session.page.evaluate(`(async () => {
    const AssetRegistry = window.__SCENE__.game.view.vehicles.registry.constructor;
    const variants = AssetRegistry.prototype.definition.call(window.__SCENE__.game.view.vehicles.registry, 'veh.fire-engine').decayVariants;
    if (!['wrecked', 'burned'].every(v => variants.includes(v))) throw new Error('Missing damage variants');
    const load = AssetRegistry.prototype.loadAsset;
    AssetRegistry.prototype.loadAsset = function(id, quality, decay) {
      return load.call(this, id, id === 'veh.fire-engine' ? window.engineReviewLod : quality, decay);
    };
  })()`);
  for (const lod of ['lod0', 'lod1', 'lod2']) {
    await session.page.evaluate(`window.engineReviewLod = '${lod}'`);
    for (const mode of ['game', 'close'] as const) {
      await session.load({ name: `engine-${lod}-${mode}`, ground: 'asphalt', size: 40, time: 'L2',
        vehicles: [
          { id: 'pristine', asset: 'vehicle.fire-engine', at: [0, -6] },
          { id: 'wrecked', asset: 'vehicle.fire-engine', at: [0, 0], decay: 'wrecked' },
          { id: 'burned', asset: 'vehicle.fire-engine', at: [0, 6], decay: 'burned' },
        ], camera: mode === 'game' ? { mode, target: [0, 1, 0], zoom: 1.4 } : { mode, target: [0, 1, 0], radius: 23, azimuth: 225 }, expect: { consoleErrors: 0 } });
      await session.step(60); await session.ready();
      await session.screenshot(`${out}/${lod}-${mode}.png`);
      const geometry = await session.page.evaluate<{ id: number; decay?: string; triangles: number; placeholder: boolean; doors: { name: string; meshes: number }[] }[]>(`(() => [...window.__SCENE__.game.view.vehicles.records].map(([id, r]) => {
        let triangles = 0; r.model.traverse(n => { if (n.isMesh) triangles += (n.geometry.index?.count ?? n.geometry.attributes.position.count) / 3; });
        return { id, decay: r.decay, triangles, placeholder: !!r.model.userData.placeholder, doors: ['doorL', 'doorR'].map(name => { const door = r.model.getObjectByName(name); let meshes = 0; door?.traverse(n => { if (n.isMesh) meshes++; }); return { name, meshes }; }) };
      }))()`);
      console.log(lod, mode, JSON.stringify(geometry));
      const pristine = geometry[0].triangles;
      if (lod === 'lod0' ? pristine < 6000 : lod === 'lod1' ? pristine <= 2000 || pristine > 6400 : pristine > 2400) throw new Error('Wrong delivered LOD in acceptance capture');
      if (geometry.some(r => r.doors.some(d => !d.meshes))) throw new Error('Door geometry missing');
      if (geometry.some(r => r.placeholder)) throw new Error('Placeholder in acceptance capture');
      metrics.push({ lod, mode, geometry, metrics: await session.metrics(), errors: [...session.errors] });
    }
  }
  writeFileSync(`${out}/metrics.json`, JSON.stringify(metrics, null, 2) + '\n');
  if (session.errors.length) throw new Error(session.errors.join('\n'));
} finally { await session.close(); stopServer(); }
