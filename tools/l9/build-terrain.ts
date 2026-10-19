/** Split the retained greybox into independently unloadable local cells and a
 * coarse horizon. No Blender rebuild or change to the gameplay layout is needed. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { cloneDocument, join, prune } from '@gltf-transform/functions';
import { MeshoptDecoder } from 'meshoptimizer';
import { layoutTerrainChunks } from '../../src/sim/world/TerrainChunks';
import type { DistrictLayout } from '../../src/levels/districts/types';
const district = process.argv[2] ?? 'D-CROSSING';
if (!['D-CROSSING', 'D-CURE'].includes(district)) throw Error(`Unsupported streamed district ${district}`);
const layout = JSON.parse(readFileSync(`public/assets/layouts/${district}.layout.json`, 'utf8')) as DistrictLayout;
const chunks = layoutTerrainChunks(layout);

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const source = await io.read(`public/assets/layouts/${district}.base.glb`);
for (const extension of source.getRoot().listExtensionsUsed()) extension.dispose();
const out = `public/assets/layouts/${district}.chunks`;
mkdirSync(out, { recursive: true });
const counts: Record<string, number> = {};
for (const cell of chunks) {
  const doc = cloneDocument(source);
  for (const node of doc.getRoot().listNodes()) {
    if (node.getExtras().terrainChunk !== cell.id) node.dispose();
    else node.setTranslation([0, 0, 0]); // origin belongs to the runtime cell, not the geometry
  }
  await doc.transform(prune());
  const triangles = doc.getRoot().listMeshes().reduce((sum, mesh) => sum + mesh.listPrimitives().reduce((n, p) => n + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION')!.getCount()) / 3, 0), 0);
  if (triangles > 800) throw Error(`${cell.id}: ${triangles} exceeds the terrain LOD2 cap`);
  counts[cell.id] = triangles;
  await io.write(`${out}/${cell.id}.glb`, doc);
}
/** D-CURE (look-l10): verge/road wear patches fragment the ground, so its horizon is one coarse ground sheet plus the road. */
const nearField = new Set(['pal_picketWhite', 'pal_canvasTan']);
const horizon = cloneDocument(source);
for (const node of horizon.getRoot().listNodes()) {
  if (!node.getMesh()) { node.dispose(); continue; }
  if (node.getExtras().terrainChunk) {
    const mesh = node.getMesh()!;
    for (const p of mesh.listPrimitives()) { const name = p.getMaterial()?.getName() ?? ''; if (nearField.has(name) || district === 'D-CURE' && name !== 'pal_asphalt') p.dispose(); } // paint and gravel ruts are near-field detail; D-CURE keeps only the road over its ground sheet
    const [x, y, z] = node.getTranslation();
    node.setTranslation([x, y - .010, z]); // no coplanar fighting; even 1 cm fork arrows stay within the 2 cm seam budget
    node.setExtras({});
  }
}
if (district === 'D-CURE') {
  const grass = horizon.getRoot().listMaterials().find(m => m.getName() === 'pal_grass');
  if (!grass) throw Error('D-CURE horizon: no pal_grass material for the ground sheet');
  const xs = layout.bounds.map(p => p[0]), zs = layout.bounds.map(p => p[1]), [x0, x1, z0, z1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
  const buffer = horizon.getRoot().listBuffers()[0];
  const position = horizon.createAccessor().setType('VEC3').setArray(new Float32Array([x0, -.03, z0, x1, -.03, z0, x1, -.03, z1, x0, -.03, z1])).setBuffer(buffer);
  const normal = horizon.createAccessor().setType('VEC3').setArray(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0])).setBuffer(buffer);
  const indices = horizon.createAccessor().setType('SCALAR').setArray(new Uint16Array([0, 2, 1, 0, 3, 2])).setBuffer(buffer);
  const sheet = horizon.createMesh('horizon-ground').addPrimitive(horizon.createPrimitive().setAttribute('POSITION', position).setAttribute('NORMAL', normal).setIndices(indices).setMaterial(grass));
  horizon.getRoot().listScenes()[0].addChild(horizon.createNode('horizon-ground').setMesh(sheet));
}
await horizon.transform(join(), prune());
const horizonTriangles = horizon.getRoot().listMeshes().reduce((sum, mesh) => sum + mesh.listPrimitives().reduce((n, p) => n + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION')!.getCount()) / 3, 0), 0);
if (horizonTriangles > 10_000) throw Error(`Horizon: ${horizonTriangles} exceeds 10,000`);
await io.write(`public/assets/layouts/${district}.horizon.glb`, horizon);
writeFileSync(`${out}/manifest.json`, JSON.stringify({ sourceHash: layout.geometryHash, horizonTriangles, triangles: counts }, null, 2) + '\n');
console.log(`${chunks.length} local cells (max ${Math.max(...Object.values(counts))} triangles), horizon ${horizonTriangles} triangles`);
