/** Triangles per material of GLBs (meshopt aware). usage: npx tsx tools/qa/glb-tris.ts <file.glb>... */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
for (const file of process.argv.slice(2)) {
  const doc = await io.read(file);
  const by: Record<string, number> = {};
  let total = 0;
  for (const mesh of doc.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) {
    const n = (p.getIndices()?.getCount() ?? p.getAttribute('POSITION')!.getCount()) / 3;
    const k = p.getMaterial()?.getName() ?? '?';
    by[k] = (by[k] ?? 0) + n; total += n;
  }
  console.log(file.split('/').pop(), total, process.env.BY ? JSON.stringify(by) : '');
}
