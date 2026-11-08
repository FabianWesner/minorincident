import { writeFileSync } from 'node:fs';
import { Matrix4, Vector3, Box3 } from 'three';
import { assetIO } from './io';
/** Small semantic bounds for the sim; geometry stays in the existing GLBs. */
const io = await assetIO();
const output: Record<string, { name: string; min: number[]; max: number[]; role: string }[]> = {};
for (const id of ['bld.house-a', 'veh.sedan-blue', 'veh.sedan-green']) {
  const doc = await io.read(`public/assets/models/${id}.glb`);
  output[id] = [];
  for (const node of doc.getRoot().listNodes()) {
    const name = node.getName();
    if (!/^(roof$|window_|door)/.test(name)) continue;
    const box = new Box3(), point = new Vector3();
    node.traverse(child => {
      const matrix = new Matrix4().fromArray(child.getWorldMatrix());
      for (const primitive of child.getMesh()?.listPrimitives() ?? []) {
        const positions = primitive.getAttribute('POSITION'), indices = primitive.getIndices();
        if (!positions) continue;
        const value: number[] = [];
        for (let i = 0; i < (indices?.getCount() ?? positions.getCount()); i++) {
          positions.getElement(indices ? indices.getScalar(i) : i, value);
          box.expandByPoint(point.fromArray(value).applyMatrix4(matrix));
        }
      }
    });
    if (box.isEmpty()) continue;
    output[id].push({ name, min: box.min.toArray().map(v => +v.toFixed(4)), max: box.max.toArray().map(v => +v.toFixed(4)), role: name.startsWith('window') ? 'glass' : name === 'roof' ? 'roof' : 'door' });
  }
}
writeFileSync('src/data/destructionParts.json', JSON.stringify(output));
