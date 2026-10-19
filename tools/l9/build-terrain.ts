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
/** Materials that only the L9 detail overlays use (layouts/D-CROSSING/dress.py): the coarse horizon keeps the plain ground. */
const nearField = new Set(['pal_picketWhite', 'pal_canvasTan', 'pal_leather', 'pal_mustard', 'pal_mustardLight', 'pal_apronOlive', 'pal_olive', 'pal_oliveLight', 'pal_trouserLight', 'pal_uiDark', 'pal_pantsDark', 'pal_pantsLight', 'pal_leatherShadow']);
const horizon = cloneDocument(source);
for (const node of horizon.getRoot().listNodes()) {
  if (!node.getMesh()) { node.dispose(); continue; }
  if (node.getExtras().terrainChunk) {
    const mesh = node.getMesh()!;
    for (const p of mesh.listPrimitives()) if (nearField.has(p.getMaterial()?.getName() ?? '')) p.dispose(); // paint, gravel ruts, fields, shoulders and dust pans are near-field detail
    const [x, y, z] = node.getTranslation();
    node.setTranslation([x, y - .010, z]); // no coplanar fighting; even 1 cm fork arrows stay within the 2 cm seam budget
    node.setExtras({});
  }
}
await horizon.transform(join(), prune());
const horizonTriangles = horizon.getRoot().listMeshes().reduce((sum, mesh) => sum + mesh.listPrimitives().reduce((n, p) => n + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION')!.getCount()) / 3, 0), 0);
if (horizonTriangles > 10_000) throw Error(`Horizon: ${horizonTriangles} exceeds 10,000`);
await io.write(`public/assets/layouts/${district}.horizon.glb`, horizon);
writeFileSync(`${out}/manifest.json`, JSON.stringify({ sourceHash: layout.geometryHash, horizonTriangles, triangles: counts }, null, 2) + '\n');
console.log(`${chunks.length} local cells (max ${Math.max(...Object.values(counts))} triangles), horizon ${horizonTriangles} triangles`);
