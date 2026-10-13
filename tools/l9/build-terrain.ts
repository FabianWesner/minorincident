/** Split the retained greybox into independently unloadable local cells and a
 * coarse horizon. No Blender rebuild or change to the gameplay layout is needed. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { cloneDocument, join, prune } from '@gltf-transform/functions';
import { MeshoptDecoder } from 'meshoptimizer';
import { crossingChunks } from '../../src/levels/L9/district';

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const source = await io.read('public/assets/layouts/D-CROSSING.base.glb');
for (const extension of source.getRoot().listExtensionsUsed()) extension.dispose();
const out = 'public/assets/layouts/D-CROSSING.chunks';
mkdirSync(out, { recursive: true });
const counts: Record<string, number> = {};
for (const cell of crossingChunks) {
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
const horizon = cloneDocument(source);
for (const node of horizon.getRoot().listNodes()) {
  if (!node.getMesh()) { node.dispose(); continue; }
  if (node.getExtras().terrainChunk) {
    const mesh = node.getMesh()!;
    for (const p of mesh.listPrimitives()) if (p.getMaterial()?.getName() === 'pal_picketWhite') p.dispose();
    const [x, y, z] = node.getTranslation();
    node.setTranslation([x, y - .010, z]); // no coplanar fighting; even 1 cm fork arrows stay within the 2 cm seam budget
    node.setExtras({});
  }
}
await horizon.transform(join(), prune());
const horizonTriangles = horizon.getRoot().listMeshes().reduce((sum, mesh) => sum + mesh.listPrimitives().reduce((n, p) => n + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION')!.getCount()) / 3, 0), 0);
if (horizonTriangles > 10_000) throw Error(`Horizon: ${horizonTriangles} exceeds 10,000`);
await io.write('public/assets/layouts/D-CROSSING.horizon.glb', horizon);
writeFileSync(`${out}/manifest.json`, JSON.stringify({ sourceHash: JSON.parse(readFileSync('public/assets/layouts/D-CROSSING.layout.json', 'utf8')).geometryHash, horizonTriangles, triangles: counts }, null, 2) + '\n');
console.log(`${crossingChunks.length} local cells (max ${Math.max(...Object.values(counts))} triangles), horizon ${horizonTriangles} triangles`);
