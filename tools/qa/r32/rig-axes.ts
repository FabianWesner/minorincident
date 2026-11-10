// r32-alphas: print a rig's rest pose (local TRS as Euler degrees) for authoring reference.
// node --import tsx/esm tools/qa/r32/rig-axes.ts [glb]
import { assetIO } from '../../assets/io';
import { Quaternion, Euler } from 'three';
const io = await assetIO();
const doc = await io.read(process.argv[2] ?? 'assets/animation-library/library.glb');
for (const n of doc.getRoot().listNodes()) if (/^(root|hip|torso|head|armL|armR|foreArmL|foreArmR|handL|handR|legL|legR|shinL|shinR|footL|footR)$/.test(n.getName())) {
  const e = new Euler().setFromQuaternion(new Quaternion(...n.getRotation()));
  console.log(n.getName().padEnd(9), 'parent', (n.getParentNode()?.getName() ?? '-').padEnd(9), 't', n.getTranslation().map(v => v.toFixed(3)).join(','), 'r', [e.x, e.y, e.z].map(v => (v * 180 / Math.PI).toFixed(0)).join(','), 's', n.getScale().map(v => v.toFixed(2)).join(','));
}
