import { expect, test } from 'vitest';
import { assetIO } from '../../../tools/assets/io';

/** Palette seams are welded by position; touching closed solids may share an even edge. */
async function openSurfaces(id: string) {
  const io = await assetIO(), doc = await io.read(`public/assets/models/${id}.glb`);
  const result: { surface: string; openEdges: number }[] = [];
  for (const node of doc.getRoot().listNodes()) for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
    const positions = primitive.getAttribute('POSITION')!, indices = primitive.getIndices()!, edges = new Map<string, number>(), point: number[] = [];
    for (let i = 0; i < indices.getCount(); i += 3) {
      const corners = [0, 1, 2].map(k => { positions.getElement(indices.getScalar(i + k), point); return point.map(v => Math.round(v * 10000)).join(','); });
      for (let k = 0; k < 3; k++) {
        const edge = [corners[k], corners[(k + 1) % 3]].sort().join('|'); edges.set(edge, (edges.get(edge) ?? 0) + 1);
      }
    }
    const openEdges = [...edges.values()].filter(n => n % 2 !== 0).length;
    if (openEdges) result.push({ surface: `${node.getName()}/${primitive.getMaterial()?.getName()}`, openEdges });
  }
  return result;
}
for (const id of ['inf.alpha', 'inf.mega-alpha']) test(`PO #21/#29 @E18 ${id} close model has closed skin and clothing surfaces`, async () => {
  expect(await openSurfaces(id), 'LOD0 must not reintroduce thin decimated clothing shards').toEqual([]);
});
