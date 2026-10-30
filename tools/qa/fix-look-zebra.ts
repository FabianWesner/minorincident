/** Bounded Q-175 source audit; reports candidates, never rewrites a mesh from a heuristic. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { Vector3 } from 'three';
import { assetIO } from '../assets/io';

const io = await assetIO(), rows = [];
for (const id of ['amb.zebra', 'inf.zebra']) for (const lod of [0, 1, 2]) {
  const path = `public/assets/models/skinned/${id}.lod${lod}.glb`, doc = await io.read(path);
  const body = doc.getRoot().listNodes().find(n => n.getName() === 'skin_body')!;
  const joints = body.getSkin()!.listJoints().map(j => j.getName());
  let invalidWeights = 0, invalidJoints = 0, degenerate = 0, reversed = 0, crossLegTriangles = 0, reversedLegFaces = 0;
  const candidates: number[] = [];
  const crossLegCandidates: number[] = [];
  for (const p of body.getMesh()!.listPrimitives()) {
    const pos = p.getAttribute('POSITION')!, normal = p.getAttribute('NORMAL')!, weight = p.getAttribute('WEIGHTS_0')!, joint = p.getAttribute('JOINTS_0')!;
    const owners: string[] = [];
    for (let i = 0; i < pos.getCount(); i++) {
      const w = weight.getElement(i, [] as number[]), j = joint.getElement(i, [] as number[]);
      if (Math.abs(w.reduce((a, b) => a + b, 0) - 1) > .001 || w.some(v => !Number.isFinite(v) || v < 0 || v > 1)) invalidWeights++;
      if (j.some((v, k) => w[k] > 0 && (!Number.isInteger(v) || v < 0 || v >= joints.length))) invalidJoints++;
      owners.push(joints[j[w.indexOf(Math.max(...w))]]);
    }
    const indices = p.getIndices()!, a = new Vector3(), b = new Vector3(), c = new Vector3(), n = new Vector3(), mean = new Vector3();
    for (let t = 0; t < indices.getCount(); t += 3) {
      const ids = [0, 1, 2].map(k => indices.getScalar(t + k));
      a.fromArray(pos.getElement(ids[0], [])); b.fromArray(pos.getElement(ids[1], [])); c.fromArray(pos.getElement(ids[2], []));
      n.subVectors(b, a).cross(c.clone().sub(a));
      if (n.lengthSq() < 1e-18) degenerate++;
      mean.set(0, 0, 0); for (const i of ids) mean.add(new Vector3().fromArray(normal.getElement(i, [])));
      if (n.normalize().dot(mean.normalize()) < -.2) {
        reversed++; if (candidates.length < 20) candidates.push(t / 3);
        if (Math.max(a.y, b.y, c.y) < 1.4 && ids.every(i => /^(leg|paw|shin|foreArm)/.test(owners[i]))) {
          reversedLegFaces++;
        }
      }
      const legs = ids.map(i => owners[i]).filter(j => /^(leg|paw)[FB][LR]$/.test(j));
      if (legs.some(j => j.endsWith('L')) && legs.some(j => j.endsWith('R'))) { crossLegTriangles++; crossLegCandidates.push(t / 3); }
    }
  }
  rows.push({ path, invalidWeights, invalidJoints, degenerate, reversed, reversedLegFaces, crossLegTriangles, candidateFaceIndices: candidates, crossLegCandidateFaceIndices: crossLegCandidates });
}
mkdirSync('docs/reports/fix-look/checks', { recursive: true });
writeFileSync('docs/reports/fix-look/checks/q175-topology.json', JSON.stringify({ rows, interpretation: 'Rest-pose winding/weight diagnostics only; disagreement with authored normals does not identify which winding is correct.' }, null, 2) + '\n');
console.log(JSON.stringify(rows));
