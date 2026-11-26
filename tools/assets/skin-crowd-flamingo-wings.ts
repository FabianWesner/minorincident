import type { Document } from '@gltf-transform/core';
import { Matrix4, Vector3 } from 'three';

/** Fit the frozen bird hierarchy to the spread-wing TRELLIS surface. The outer
 * feather vertices blend into a forearm pivot halfway along each wing, so the
 * same surface can fold at rest and beat in flight. No vertices are moved. */
export function fitFlamingoWings(document: Document): void {
  const root = document.getRoot(), skin = root.listSkins()[0], joints = skin.listJoints();
  const mesh = root.listNodes().find(node => node.getName() === 'skin_body')!;
  const named = (name: string) => { const node = joints.find(joint => joint.getName() === name); if (!node) throw Error(`Missing flamingo joint ${name}`); return node; };
  for (const [side, sign, x] of [['L', -1, -.15], ['R', 1, .10]] as const) {
    const parent = named(`wing${side}`), forearm = named(`foreArm${side}`);
    const position = new Vector3(x, 1.04, sign * .48).applyMatrix4(new Matrix4().fromArray(parent.getWorldMatrix()).invert());
    forearm.setTranslation(position.toArray() as [number, number, number]);
  }
  const binds = skin.getInverseBindMatrices()!;
  joints.forEach((joint, i) => binds.setElement(i, new Matrix4().fromArray(joint.getWorldMatrix()).invert().toArray()));
  const meshWorld = new Matrix4().fromArray(mesh.getWorldMatrix());
  const pairs = (['L', 'R'] as const).map((side, index) => ({ sign: index ? 1 : -1, wing: joints.indexOf(named(`wing${side}`)), forearm: joints.indexOf(named(`foreArm${side}`)) }));
  for (const primitive of mesh.getMesh()!.listPrimitives()) {
    const positions = primitive.getAttribute('POSITION')!, indices = primitive.getAttribute('JOINTS_0')!, weights = primitive.getAttribute('WEIGHTS_0')!, owners = primitive.getAttribute('_CROWD_PART')!;
    for (let i = 0; i < positions.getCount(); i++) {
      const point = new Vector3().fromArray(positions.getElement(i, [])).applyMatrix4(meshWorld);
      const ids = indices.getElement(i, [] as number[]), ws = weights.getElement(i, [] as number[]);
      for (const { sign, wing, forearm } of pairs) {
        let total = 0; const kept: [number, number][] = [];
        for (let k = 0; k < 4; k++) {
          if (ids[k] === wing || ids[k] === forearm) total += ws[k];
          else if (ws[k] > 0) kept.push([ids[k], ws[k]]);
        }
        if (total < 1e-6) continue;
        const t = Math.max(0, Math.min(1, (sign * point.z - .38) / .20));
        if (total * (1 - t) > 1e-6) kept.push([wing, total * (1 - t)]);
        if (total * t > 1e-6) kept.push([forearm, total * t]);
        kept.sort((a, b) => b[1] - a[1]);
        const selected = kept.slice(0, 4), sum = selected.reduce((n, entry) => n + entry[1], 0);
        while (selected.length < 4) selected.push([0, 0]);
        for (let k = 0; k < 4; k++) { ids[k] = selected[k][0]; ws[k] = selected[k][1] / sum; }
      }
      if (!ids.some((id, k) => id === owners.getScalar(i) && ws[k] > 0)) owners.setScalar(i, ids[0]);
      indices.setElement(i, ids); weights.setElement(i, ws);
    }
  }
  const rigRoot = named('root'); rigRoot.setExtras({ ...rigRoot.getExtras(), openWingRest: true });
}
