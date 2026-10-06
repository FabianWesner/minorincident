// Run: npx tsx assets/prop.hedge/foliage-regression.ts
import assert from 'node:assert/strict';
import { assetIO } from '../../tools/assets/io';
import { triangleCount } from '../../tools/assets/delivery';
const io = await assetIO();
for (const [suffix, budget] of [['', 12000], ['.lod1', 1860], ['.lod2', 540]] as const) {
  const doc = await io.read(`public/assets/models/prop.hedge${suffix}.glb`);
  assert.ok(triangleCount(doc) <= budget, `${suffix}: triangle budget`);
  assert.ok(doc.getRoot().listNodes().some(n => n.getName() === 'col:hedge'), 'collider retained');
  for (const mat of doc.getRoot().listMaterials()) assert.match(mat.getName(), /^pal_(grass|foliage)$/, 'green foliage only');
  let slopingNormals = 0;
  for (const mesh of doc.getRoot().listMeshes()) for (const primitive of mesh.listPrimitives()) {
    const normals = primitive.getAttribute('NORMAL');
    assert.ok(normals, 'smooth surface normals retained');
    for (let i = 0; i < normals.getCount(); i++) {
      const normal = [0, 0, 0]; normals.getElement(i, normal);
      if (normal.filter(value => Math.abs(value) > .1).length > 1) slopingNormals++;
    }
  }
  assert.ok(slopingNormals > 50, 'rounded foliage has interpolated normals');
  console.log(`prop.hedge${suffix}: green rounded foliage within budget`);
}
