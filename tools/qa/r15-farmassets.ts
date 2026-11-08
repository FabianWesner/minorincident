/** Native farm rebuild audit: placement identity, shipped LODs, crop draws and traversable roofed ruins. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import manifest from '../../src/assets/manifest.json';
import type { AssetDef } from '../../src/assets/types';
import type { Placement } from '../../src/levels/districts/types';
import { cureFarmDecor } from '../../src/levels/L10/farmLayout';
import { loadLevel } from '../sim-runner/levels';
import { assetIO } from '../assets/io';
import { triangleCount } from '../assets/delivery';
import { coplanarOverlaps } from '../assets/zfight';
import { Mesh, Scene } from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { DistrictAssets } from '../../src/assets/DistrictAssets';
import { Lighting } from '../../src/render/Lighting';
import { Materials } from '../../src/render/Materials';

const report = 'docs/reports/r15-farmassets';
const baseline = JSON.parse(readFileSync('.cache/r15-farmassets/baseline/manifest.json', 'utf8')) as AssetDef[];
for (const before of baseline) {
  const after = (manifest as AssetDef[]).find(def => def.id === before.id)!;
  assert.deepEqual(after.dimensions, before.dimensions, `${before.id}: accepted placement plot changed`);
}
const original = await import(pathToFileURL(resolve('.cache/r15-farmassets/baseline/farmLayout.ts')).href) as typeof import('../../src/levels/L10/farmLayout');
const positions = (rows: Placement[]) => rows.map(row => { const copy = { ...row }; delete copy.decay; return copy; });
const bare = cureFarmDecor([]);
assert(bare.length > 100);
assert.deepEqual(positions(bare), positions(original.cureFarmDecor([])));
const io = await assetIO();
const sourceBudgets = JSON.parse(readFileSync(`${report}/asset-budgets.json`, 'utf8')) as { id: string; lod: number; burned: boolean; triangles: number; cap: number }[];
const validation = JSON.parse(readFileSync(`${report}/asset-validation.json`, 'utf8')) as { id: string; errors: string[] }[];
assert.equal(validation.length, sourceBudgets.length);
assert(validation.every(row => row.errors.length === 0));
const crop = (manifest as AssetDef[]).find(def => def.id === 'veg.corn-block')!;
const cropDraws = [];
for (const [lod, file] of [crop.glb, crop.lods!.lod1, crop.lods!.lod2].entries()) {
  const doc = await io.read(file!);
  const draws = doc.getRoot().listNodes().reduce((count, node) => count + (node.getMesh()?.listPrimitives().length ?? 0), 0);
  assert.equal(draws, 1, `crop LOD${lod}: a new draw was introduced`);
  const triangles = triangleCount(doc), cap = sourceBudgets.find(row => row.id === crop.id && row.lod === lod)!.cap;
  assert(triangles <= cap);
  const extras = doc.getRoot().listNodes().find(node => node.getName() === 'root')!.getExtras();
  assert(Number(extras.cornStalks) >= (lod === 0 ? 140 : lod === 1 ? 60 : 40));
  if (lod < 2) {
    assert(Number(extras.cornCurledLeaves) >= Number(extras.cornStalks) * 3);
    assert(Number(extras.cornBrokenStalks) > 0 && Number(extras.cornEars) > 0);
  }
  assert(Number(extras.cornFurrows) >= 9);
  cropDraws.push({ lod, draws, triangles, cap, ...extras });
}
// Check the actual production loader/batcher preserves the authored RGB instead of
// dropping it when replacing the ordinary static material with the crop shader.
const lighting = new Lighting(new Scene()), materials = new Materials(lighting);
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const assets = new DistrictAssets(materials, undefined, async url => {
  const bytes = readFileSync(`public${url}`);
  return (await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')).scene;
});
// Exercise the production RGB memory-trimming branch without creating a GPU device.
// DistrictAssets only reads this flag in remember(); loaders were constructed above.
Reflect.set(assets, 'renderer', {});
const batchColors = [];
try {
  for (const lod of ['lod0', 'lod1', 'lod2'] as const) {
    const batch = await assets.asset(crop.id, true, lod), colors = new Set<string>();
    let meshes = 0;
    batch.traverse(node => {
      if (!(node instanceof Mesh)) return;
      meshes++;
      const rgb = node.geometry.getAttribute('color'); assert(rgb, `${lod}: crop RGB was discarded`);
      for (let i = 0; i < rgb.count; i++) colors.add([rgb.getX(i), rgb.getY(i), rgb.getZ(i)].map(n => n.toFixed(3)).join(','));
    });
    assert.equal(meshes, 1); assert(colors.size >= (lod === 'lod2' ? 6 : 8));
    batchColors.push({ lod, meshes, rgbSwatches: colors.size });
  }
} finally { assets.dispose(); materials.dispose(); lighting.dispose(); }
const rawSurfaces = [];
for (const row of sourceBudgets.filter(row => /^(bld\.farm-|prop\.farm-(tractor|combine))/.test(row.id))) {
  const file = `.cache/r15-farmassets/unfolded/${row.id}${row.burned ? '.burned' : ''}.lod${row.lod}.glb`;
  const overlaps = coplanarOverlaps(await io.read(file));
  rawSurfaces.push({ id: row.id, burned: row.burned, lod: row.lod, overlaps });
}
writeFileSync(`${report}/raw-surfaces.json`, JSON.stringify(rawSurfaces, null, 2) + '\n');
assert(rawSurfaces.every(row => row.overlaps.length === 0), 'Unfolded source has coplanar colour conflicts');
const worlds = [];
for (const quality of ['high', 'low'] as const) {
  const world = await loadLevel('L10', 32, undefined, 0, { quality });
  try {
    const layout = world.districts!.districts[0].layout;
    const nonFarm = layout.placements.filter(p => !p.id.startsWith('decor-cure-corn-') && !p.id.startsWith('decor-cure-farm-'));
    const current = cureFarmDecor(nonFarm), before = original.cureFarmDecor(nonFarm);
    assert(current.length > 50);
    assert.deepEqual(positions(current), positions(before));
    const structures = layout.placements.filter(p => p.assetId.startsWith('bld.farm-'));
    assert(structures.some(p => p.decay === 'burned'));
    assert(layout.placements.some(p => p.assetId === 'prop.farm-combine' && p.decay === 'burned'));
    const walls = [];
    for (const p of structures) {
      world.chunks!.update([p.position[0], p.position[2]]);
      const house = p.assetId === 'bld.farm-house-ruin', width = house ? 8 : 7, depth = house ? 7 : 8;
      const c = Math.cos(p.yaw), s = Math.sin(p.yaw);
      const at = (x: number, z: number) => ({ x: p.position[0] + x * c + z * s, z: p.position[2] - x * s + z * c });
      for (const side of [-1, 1]) {
        const wall = at(width * .28, side * depth / 2);
        assert(!world.infected!.nav.clear(wall.x, wall.z, .3), `${quality}: wall clipping at ${p.id}`);
      }
      let samples = 0;
      for (let z = -depth / 2 - .6; z <= depth / 2 + .6; z += .25) {
        const door = at(0, z);
        assert(world.infected!.nav.clear(door.x, door.z, .35), `${quality}: escape aisle blocked at ${p.id}, ${z}`);
        samples++;
      }
      walls.push({ id: p.id, decay: p.decay ?? 'rusted', aisleSamples: samples, wallsBlock: true });
    }
    const farm = layout.placements.filter(p => /decor-cure-(corn|farm)-/.test(p.id));
    worlds.push({ quality, placementCount: farm.length, transformSha256: createHash('sha256').update(JSON.stringify(positions(farm))).digest('hex'), walls });
  } finally { world.dispose(); }
}
writeFileSync(`${report}/native-audit.json`, JSON.stringify({ baselineRevision: '08149d1a', samePlots: baseline.length, placementAlgorithmUnchanged: true, sourceAssetTiers: sourceBudgets.length, validatedAssetTiers: validation.length, cropDraws, batchColors, worlds }, null, 2) + '\n');
console.log('Farm rebuild: unchanged placement, all shipped tiers valid, one crop draw, walls block and both doorways pass at high/low');
