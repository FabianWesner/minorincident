import { readFileSync, writeFileSync } from 'node:fs';
import { AnimationMixer, Vector3, type Object3D, type SkinnedMesh } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { alignSkeleton } from '../../src/render/characters/skin';
import { retargetClip, skinClips } from '../../src/render/characters/clips';
import { courierBones, driveHelpers } from '../../src/render/characters/CourierRig';
import { resolveRig } from '../../src/render/characters/rig';

/** Edge-stretch audit of a skinned courier GLB under the PRODUCTION evaluation: alignSkeleton, retargetClip with the
 * skin overrides (rigid-library fallback for every other action), and the stateless helper drive after each sample.
 * Same stretch rule as the 3D pipeline's audit_animation_deformation.mjs (rest edge > 1 mm, posed edge > 3 cm; flag > 4×).
 * Ground contacts, look-at and the bag/ponytail layers are not applied (they move bones within the same chains).
 * Usage: npx tsx tools/assets/courier-stretch-audit.ts <skin.glb> <report.json> [steps=24] */
const [source, reportPath, stepsArg = '24'] = process.argv.slice(2);
const steps = Number(stepsArg);
const clips = ['idle', 'walk', 'run', 'carry', 'hurt', 'ride', 'mount', 'dismount', 'unarmed-jab', 'unarmed-cross', 'unarmed-front-kick', 'unarmed-roundhouse-kick',
  'kick', 'spin-kick', 'bat-1', 'bat-2', 'bat-3', 'crowbar-1', 'machete-1', 'machete-2', 'machete-3', 'swing', 'windup', 'shoot', 'throw', 'interact', 'hand-over', 'equip', 'rack-grab', 'stagger-left', 'stagger-right'];

const raw = readFileSync(source);
// Images cannot decode in Node; geometry, skin and nodes are all the audit needs.
let json: Record<string, unknown> & { materials?: { name?: string }[] } = {}, bin = Buffer.alloc(0);
for (let i = 12; i < raw.length;) { const n = raw.readUInt32LE(i), kind = raw.readUInt32LE(i + 4); if (kind === 0x4e4f534a) json = JSON.parse(raw.subarray(i + 8, i + 8 + n).toString()); if (kind === 0x004e4942) bin = raw.subarray(i + 8, i + 8 + n); i += 8 + n; }
json.images = []; json.textures = []; json.samplers = []; json.materials = (json.materials ?? []).map(m => ({ name: m.name ?? '' }));
const text = Buffer.from(JSON.stringify(json)), padded = Buffer.alloc(Math.ceil(text.length / 4) * 4, 32); text.copy(padded);
const glb = Buffer.alloc(28 + padded.length + bin.length);
glb.writeUInt32LE(0x46546c67, 0); glb.writeUInt32LE(2, 4); glb.writeUInt32LE(glb.length, 8); glb.writeUInt32LE(padded.length, 12); glb.writeUInt32LE(0x4e4f534a, 16); padded.copy(glb, 20);
glb.writeUInt32LE(bin.length, 20 + padded.length); glb.writeUInt32LE(0x004e4942, 24 + padded.length); bin.copy(glb, 28 + padded.length);
await MeshoptDecoder.ready;
const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.length) as ArrayBuffer, '');
const model = gltf.scene;
const meshes = alignSkeleton(model);
const rig = resolveRig(model as never, 1.455), bones = courierBones(model)!;
const posed = (mesh: SkinnedMesh): Vector3[] => { mesh.skeleton.update(); return Array.from({ length: mesh.geometry.attributes.position.count }, (_, i) => mesh.getVertexPosition(i, new Vector3()).applyMatrix4(mesh.matrixWorld)); };
model.updateMatrixWorld(true);
const rest = meshes.map(posed);
const edges = meshes.map((mesh, m) => {
  const index = mesh.geometry.index!.array, seen = new Set<string>(), out: { a: number; b: number; length: number }[] = [];
  for (let f = 0; f < index.length; f += 3) for (let k = 0; k < 3; k++) {
    const a = index[f + k], b = index[f + (k + 1) % 3], key = a < b ? `${a},${b}` : `${b},${a}`;
    if (seen.has(key)) continue; seen.add(key); out.push({ a, b, length: rest[m][a].distanceTo(rest[m][b]) });
  }
  return out;
});
const mixer = new AnimationMixer(model);
const report: { clip: string; samples: number; over2: number; over4: number; worst: number; worstTime: number; worstBones: string[]; at?: number[][] }[] = [];
const restPose = new Map<Object3D, [Vector3, import('three').Quaternion]>();
model.traverse(node => restPose.set(node, [node.position.clone(), node.quaternion.clone()]));
for (const name of clips) {
  for (const [node, [p, q]] of restPose) { node.position.copy(p); node.quaternion.copy(q); node.scale.set(1, 1, 1); }
  let clip;
  try { clip = retargetClip(rig.root, name, false, skinClips); } catch { report.push({ clip: name, samples: 0, over2: -1, over4: -1, worst: -1, worstTime: 0, worstBones: ['missing clip'] }); continue; }
  mixer.stopAllAction(); const action = mixer.clipAction(clip, rig.root); action.reset().play();
  let over2 = 0, over4 = 0, worst = 0, worstTime = 0, worstEdge: [number, number, number] = [0, 0, 0];
  for (let step = 0; step <= steps; step++) {
    const time = clip.duration * step / steps; mixer.setTime(time); model.updateMatrixWorld(true);
    driveHelpers(rig, bones); model.updateMatrixWorld(true);
    meshes.forEach((mesh, m) => {
      const p = posed(mesh);
      for (const e of edges[m]) {
        const after = p[e.a].distanceTo(p[e.b]);
        if (e.length > .001 && after > .03) { const s = after / e.length; if (s > 2) over2++; if (s > 4) over4++; if (s > worst) { worst = s; worstTime = time; worstEdge = [m, e.a, e.b]; } }
      }
    });
  }
  mixer.uncacheClip(clip);
  const mesh = meshes[worstEdge[0]], skinIndex = mesh.geometry.attributes.skinIndex, skinWeight = mesh.geometry.attributes.skinWeight;
  const names = new Set<string>();
  for (const v of [worstEdge[1], worstEdge[2]]) for (let k = 0; k < 4; k++) if (skinWeight.getComponent(v, k) > .2) names.add(mesh.skeleton.bones[skinIndex.getComponent(v, k)].name);
  report.push({ clip: name, samples: steps + 1, over2, over4, worst: +worst.toFixed(2), worstTime: +worstTime.toFixed(3), worstBones: [...names], at: [rest[worstEdge[0]][worstEdge[1]], rest[worstEdge[0]][worstEdge[2]]].map(v => v.toArray().map(x => +x.toFixed(3))) });
}
const summary = { source, triangles: meshes.reduce((n, mesh) => n + mesh.geometry.index!.count / 3, 0), maxStretch: Math.max(...report.map(r => r.worst)), flaggedOver4: report.reduce((n, r) => n + Math.max(0, r.over4), 0), clips: report };
writeFileSync(reportPath, JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify({ maxStretch: summary.maxStretch, flaggedOver4: summary.flaggedOver4 }));
for (const r of report) console.log(r.clip.padEnd(24), String(r.worst).padStart(6), 'over2', r.over2, 'over4', r.over4, r.worstBones.join('+'), JSON.stringify(r.at ?? ''));
