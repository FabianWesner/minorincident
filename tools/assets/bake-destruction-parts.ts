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
// The rebuilt farm GLBs fold their original nodes into one mesh. These bounds
// follow building() in tools/blender/sslib/farm_assets.py: solid side walls,
// split gable piers, an open central doorway and a pitched roof. They are hit
// zones only; the authored walk-through ruins have no solid collision owner.
for (const [id, house] of [['bld.farm-house-ruin', true], ['bld.farm-barn-ruin', false]] as const) {
  const w = house ? 8 : 7, d = house ? 7 : 8, eave = house ? 2.55 : 3.35, opening = house ? 1.8 : 2.8;
  const parts: (typeof output)[string] = [];
  for (const side of [-1, 1]) {
    parts.push({ name: `farm-side-${side}`, role: 'structure', min: [side*w/2-.27, .45, -d/2-.25], max: [side*w/2+.27, eave, d/2+.25] });
    for (const end of [-1, 1]) {
      const minX = side < 0 ? -w/2-.15 : opening/2-.12, maxX = side < 0 ? -opening/2+.12 : w/2+.15;
      parts.push({ name: `farm-pier-${side}-${end}`, role: 'structure', min: [minX, .45, end*d/2-.3], max: [maxX, eave, end*d/2+.3] });
    }
    parts.push({ name: `farm-header-${side}`, role: 'structure', min: [-opening/2, 2.16, side*d/2-.3], max: [opening/2, eave, side*d/2+.3] });
  }
  parts.push({ name: 'farm-roof', role: 'roof', min: [-w/2-.25, eave-.12, -d/2-.3], max: [w/2+.25, house ? 4.12 : 5.3, d/2+.3] });
  output[id] = parts;
}
writeFileSync('src/data/destructionParts.json', JSON.stringify(output));
