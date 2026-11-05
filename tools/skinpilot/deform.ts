/** Offline deformation probe for the fitted courier skins (research docs/research/figure-improvements.md §1.2).
 * Poses one joint at a time from the bind pose, skins the mesh on the CPU with three's linear blend skinning
 * (SkinnedMesh.applyBoneTransform, what the GPU does) and reports, for the triangles of a geometric band around the
 * joint: the joint-centred fan volume ratio (1.0 = preserved) and the worst edge stretch. Skeleton v2 skins are posed
 * the way the runtime does it: torso twist spreads over torso/spine/chest, a head turn over neck/head (retarget), and
 * the elbow/knee/twist helpers come from driveHelpers. Bands are geometric, so v1 and v2 compare like for like.
 *   npx tsx tools/skinpilot/deform.ts [out.json] [--glb=path.glb,...] */
import { readFileSync, writeFileSync } from 'node:fs';
import { Quaternion, SkinnedMesh, Vector3, type Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { alignSkeleton } from '../../src/render/characters/skin';
import { courierBones, driveHelpers } from '../../src/render/characters/CourierRig';
import { resolveRig } from '../../src/render/characters/rig';

const args = process.argv.slice(2), out = args.find(a => !a.startsWith('--'));
const glbs = args.find(a => a.startsWith('--glb='))?.slice(6).split(',') ?? ['public/assets/models/char.courier-female.skin.glb', 'public/assets/models/char.courier-male.skin.glb'];
const DEG = Math.PI / 180;
async function load(path: string) {
  const file = readFileSync(path);
  return (await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength), '')).scene;
}
type Rig = ReturnType<typeof resolveRig>;
interface Pose { name: string; joint: keyof Rig; child: keyof Rig; limb: string[]; half: number; radius: number; lift?: number; apply(rig: Rig, root: Object3D, v2: boolean): void }
const axis = (x: number, y: number, z: number, angle: number) => new Quaternion().setFromAxisAngle(new Vector3(x, y, z).normalize(), angle);
const spread = (root: Object3D, names: string[], q: Quaternion, shares: number[]) => names.forEach((n, i) => root.getObjectByName(n)!.quaternion.copy(new Quaternion().slerp(q, shares[i])));
const arm = ['clavicleL', 'armL', 'elbowL', 'foreArmL', 'foreArmTwistL', 'handL'], leg = ['legL', 'kneeL', 'shinL', 'footL', 'toeL'];
const poses: Pose[] = [
  { name: 'elbow flex 120°', joint: 'foreArmL', child: 'handL', limb: arm, half: .045, radius: .065, apply: r => r.foreArmL.quaternion.copy(axis(0, 0, 1, 120 * DEG)) },
  { name: 'wrist twist 90°', joint: 'handL', child: 'weaponSocketL', limb: arm, half: .045, radius: .065, apply: r => r.handL.quaternion.copy(axis(r.handL.position.x, r.handL.position.y, r.handL.position.z, 90 * DEG)) },
  { name: 'knee flex 90°', joint: 'shinL', child: 'footL', limb: leg, half: .05, radius: .08, apply: r => r.shinL.quaternion.copy(axis(0, 0, 1, -90 * DEG)) },
  { name: 'hip flex 80°', joint: 'legL', child: 'shinL', limb: [...leg, 'hip'], half: .05, radius: .1, apply: r => r.legL.quaternion.copy(axis(0, 0, 1, 80 * DEG)) },
  { name: 'shoulder forward 90°', joint: 'armL', child: 'foreArmL', limb: [...arm, 'chest', 'torso', 'spine'], half: .05, radius: .09, apply: r => r.armL.quaternion.copy(axis(0, 0, 1, 90 * DEG)) },
  { name: 'shoulder abduct 80°', joint: 'armL', child: 'foreArmL', limb: [...arm, 'chest', 'torso', 'spine'], half: .05, radius: .09, apply: r => r.armL.quaternion.copy(axis(-1, 0, 0, 80 * DEG)) },
  { name: 'torso twist 45°', joint: 'torso', child: 'head', limb: ['hip', 'torso', 'spine', 'chest'], half: .1, radius: .2, lift: .07, apply: (r, root, v2) => v2 ? spread(root, ['torso', 'spine', 'chest'], axis(0, 1, 0, 45 * DEG), [1 / 3, 1 / 3, 1 / 3]) : r.torso.quaternion.copy(axis(0, 1, 0, 45 * DEG)) },
  { name: 'head turn 60°', joint: 'head', child: 'head', limb: ['chest', 'neck', 'head', 'torso', 'spine'], half: .05, radius: .09, apply: (r, root, v2) => v2 ? spread(root, ['neck', 'head'], axis(0, 1, 0, 60 * DEG), [.45, .55]) : r.head.quaternion.copy(axis(0, 1, 0, 60 * DEG)) },
];
const report: Record<string, unknown>[] = [];
for (const path of glbs) {
  const scene = await load(path), meshes = alignSkeleton(scene), mesh = meshes[0] as SkinnedMesh, rig = resolveRig(scene);
  const bones = courierBones(rig.root), v2 = !!bones;
  const geometry = mesh.geometry, position = geometry.getAttribute('position'), skinIndex = geometry.getAttribute('skinIndex'), skinWeight = geometry.getAttribute('skinWeight');
  const index = geometry.index!, names = mesh.skeleton.bones.map(b => b.name);
  const rest = Array.from({ length: position.count }, (_, i) => new Vector3().fromBufferAttribute(position, i));
  const restQ = new Map<Object3D, Quaternion>(); scene.traverse(n => restQ.set(n, n.quaternion.clone()));
  const reset = () => { for (const [n, q] of restQ) n.quaternion.copy(q); };
  scene.updateMatrixWorld(true);
  const row: Record<string, unknown> = { glb: path, skeleton: v2 ? 2 : 1, bones: names.length, vertices: position.count };
  for (const pose of poses) {
    reset(); scene.updateMatrixWorld(true);
    const center = rig[pose.joint].getWorldPosition(new Vector3()); center.y += pose.lift ?? 0;
    const dir = pose.joint === pose.child || pose.joint === 'torso' ? new Vector3(0, 1, 0) : rig[pose.child].getWorldPosition(new Vector3()).sub(center).normalize();
    // Band: limb-owned vertices (≥ 50 % weight on the limb's bones) within ±half along the bone and radius of its axis.
    const inBand = rest.map((p, i) => {
      let owned = 0;
      for (let k = 0; k < 4; k++) if (pose.limb.includes(names[skinIndex.getComponent(i, k)])) owned += skinWeight.getComponent(i, k);
      const d = p.clone().sub(center), along = d.dot(dir), radial = d.addScaledVector(dir, -along).length();
      return owned >= .5 && Math.abs(along) <= pose.half && radial <= pose.radius;
    });
    const tris: number[] = [];
    for (let t = 0; t < index.count; t += 3) if (inBand[index.getX(t)] && inBand[index.getX(t + 1)] && inBand[index.getX(t + 2)]) tris.push(index.getX(t), index.getX(t + 1), index.getX(t + 2));
    pose.apply(rig, scene, v2); if (bones) driveHelpers(rig, bones);
    scene.updateMatrixWorld(true); mesh.skeleton.update();
    const posed = rest.map((_, i) => mesh.applyBoneTransform(i, new Vector3().fromBufferAttribute(position, i)));
    const posedCenter = rig[pose.joint].getWorldPosition(new Vector3()); posedCenter.y += pose.lift ?? 0;
    const fan = (pts: Vector3[], c: Vector3) => { let v = 0; const a = new Vector3(), b = new Vector3(), d = new Vector3(); for (let t = 0; t < tris.length; t += 3) { a.subVectors(pts[tris[t]], c); b.subVectors(pts[tris[t + 1]], c); d.subVectors(pts[tris[t + 2]], c); v += a.dot(b.cross(d)) / 6; } return v; };
    let stretch = 0, worst = [0, 0];
    for (let t = 0; t < tris.length; t += 3) for (let e = 0; e < 3; e++) { const i = tris[t + e], j = tris[t + (e + 1) % 3], r = rest[i].distanceTo(rest[j]); if (r > .005 && posed[i].distanceTo(posed[j]) / r > stretch) { stretch = posed[i].distanceTo(posed[j]) / r; worst = [i, j]; } }
    if (process.env.DEFORM_DEBUG) for (const i of worst) console.log(pose.name, i, rest[i].toArray().map(v => v.toFixed(3)), [0, 1, 2, 3].map(k => `${names[skinIndex.getComponent(i, k)]}:${skinWeight.getComponent(i, k).toFixed(2)}`).join(' '), rest[worst[0]].distanceTo(rest[worst[1]]).toFixed(4));
    row[pose.name] = { triangles: tris.length / 3, volume: +(fan(posed, posedCenter) / fan(rest, center)).toFixed(3), stretch: +stretch.toFixed(2) };
  }
  report.push(row); console.log(JSON.stringify(row));
}
if (out) writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
