/** skinned-crowd prototype: per-LOD vertex/influence statistics and the pose-atlas texel fetches per vertex.
 *   npx tsx tools/assets/skin-crowd-stats.ts > docs/reports/skinned-crowd/vertex-stats.json */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const rows = [];
for (const id of ['inf.common-worker', 'npc.civilian-woman-a']) for (const lod of [0, 1, 2]) {
  const doc = await io.read(`public/assets/models/skinned/${id}.lod${lod}.glb`);
  let vertices = 0, influences = 0, multi = 0, triangles = 0; const histogram = [0, 0, 0, 0];
  for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) {
    const weights = prim.getAttribute('WEIGHTS_0')!, el: number[] = [];
    triangles += (prim.getIndices()?.getCount() ?? 0) / 3;
    for (let i = 0; i < weights.getCount(); i++) {
      weights.getElement(i, el); const n = el.filter(w => w > 0).length;
      vertices++; influences += n; histogram[n - 1]++; if (n > 1) multi++;
    }
  }
  // Each influence reads 4 matrix columns from 2 interpolated atlas frames (8 texels, +4 while a clip fades).
  rows.push({ id, lod, vertices, triangles, meanInfluences: +(influences / vertices).toFixed(3), multiInfluenceShare: +(multi / vertices).toFixed(3), histogram, texelFetchesPerVertex: { rigid: 8, skinned: +(8 * influences / vertices).toFixed(2) } });
}
console.log(JSON.stringify(rows, null, 1));
