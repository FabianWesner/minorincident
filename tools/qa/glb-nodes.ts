/** List nodes with meshes: name, triangles, materials, terrainChunk extra. usage: npx tsx tools/qa/glb-nodes.ts <file.glb> [material] */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(process.argv[2]);
for (const n of doc.getRoot().listNodes()) {
  const m = n.getMesh(); if (!m) continue;
  for (const p of m.listPrimitives()) {
    const mat = p.getMaterial()?.getName();
    if (process.argv[3] && mat !== process.argv[3]) continue;
    console.log(n.getName(), mat, (p.getIndices()?.getCount() ?? 0) / 3, JSON.stringify(n.getExtras()).slice(0, 80));
  }
}
