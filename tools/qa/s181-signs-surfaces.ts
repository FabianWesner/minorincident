/** Measure the existing fallback board against the actual LOD0 building meshes. */
import { readFileSync, readdirSync } from 'node:fs';
import { DoubleSide, Mesh, Raycaster, Vector3, type Material, type Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'meshoptimizer';
import { stripGlbTextures } from '../assets/stripGlbTextures';
import type { DistrictLayout } from '../../src/levels/districts/types';
import manifest from '../../src/assets/manifest.json' with { type: 'json' };

const cache = new Map<string, Object3D>();
for (const file of readdirSync('public/assets/layouts').filter(f => f.endsWith('.layout.json'))) {
  const d = JSON.parse(readFileSync(`public/assets/layouts/${file}`, 'utf8')) as DistrictLayout;
  const seen = new Set<string>();
  for (const b of d.buildings) {
    if (/^(?:.*\bhouse|residential fringe|countryside|city edge|next city|farm outbuilding|outbuilding|building|kessler's cellar)$/i.test(b.label) || seen.has(b.label.toLowerCase())) continue;
    seen.add(b.label.toLowerCase());
    if (b.id.startsWith('bld.cure-lab-main:')) continue;
    const p = d.placements.find(p => p.id === b.id); if (!p) continue;
    let model = cache.get(b.assetId);
    if (!model) {
      const path = manifest.find(a => a.id === b.assetId)?.glb;
      if (!path) { console.log(JSON.stringify({ district: d.district, label: b.label, asset: b.assetId, error: 'no GLB' })); continue; }
      const bytes = readFileSync(path);
      model = (await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(stripGlbTextures(bytes), '')).scene;
      model.traverse(o => { if (o instanceof Mesh) for (const m of (Array.isArray(o.material) ? o.material : [o.material]) as Material[]) m.side = DoubleSide; });
      cache.set(b.assetId, model);
    }
    model.position.fromArray(p.position); model.rotation.set(0, p.yaw, 0); model.scale.fromArray(p.scale); model.updateMatrixWorld(true);
    const min = b.aabb.min, max = b.aabb.max, x = (min[0] + max[0]) / 2, z = max[2] + .045;
    const y = Math.max(1.65, Math.min(3.1, min[1] + (max[1] - min[1]) * .55));
    const ray = new Raycaster(new Vector3(x, y, z + .01), new Vector3(0, 0, -1), 0, 20);
    const hit = ray.intersectObject(model, true)[0];
    console.log(JSON.stringify({ district: d.district, label: b.label, asset: b.assetId, yaw: p.yaw, distance: hit ? +hit.distance.toFixed(3) : null, part: hit?.object.name ?? null }));
  }
}
