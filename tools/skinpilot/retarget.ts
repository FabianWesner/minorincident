/** Offline: retarget Mesh2Motion CC0 human clips onto the courier skeleton v2 (21 animated joints, 1:1 Mesh2Motion
 * names for pelvis, spine_01..03, neck_01, head, clavicles, limbs).
 * Output: src/render/characters/library.skin.json (same schema as library.json: rest-relative local
 * rotations, hip translation deltas). No runtime dependency on Mesh2Motion; data is CC0.
 *   MESH2MOTION_SOURCE=/private/tmp/motion-lib-mesh2motion npx tsx tools/skinpilot/retarget.ts
 * Method: world-space rotation deltas for pelvis/chest/head/hands/feet; limb bones by direction
 * (swing) so A/T rest-pose differences cannot leak in; hip travel scaled by leg length, loop drift
 * removed; loops re-phased so the left heel strikes at t=0 (the plantLocomotion contract);
 * upper-body deltas exaggerated for the cartoon read. Legs of walk/run are re-solved at runtime by
 * plantLocomotion against the real stride, so contacts match sim speed. */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { AnimationMixer, Object3D, Quaternion, Vector3, type AnimationClip, type Bone } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const checkout = process.env.MESH2MOTION_SOURCE ?? '/private/tmp/motion-lib-mesh2motion';
const commit = execFileSync('git', ['-C', checkout, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (commit !== '79f3f61a9852ef70234a5a4a7c13ed87f7a71833') throw new Error(`Mesh2Motion checkout must be the pinned commit, got ${commit}`);

async function load(path: string) {
  const file = readFileSync(path), size = file.readUInt32LE(12), json = JSON.parse(file.subarray(20, 20 + size).toString());
  for (const m of json.materials ?? []) { delete m.normalTexture; delete m.occlusionTexture; delete m.emissiveTexture; if (m.pbrMetallicRoughness) { delete m.pbrMetallicRoughness.baseColorTexture; delete m.pbrMetallicRoughness.metallicRoughnessTexture; } }
  delete json.images; delete json.textures; delete json.samplers;
  const text = Buffer.from(JSON.stringify(json)), padded = Math.ceil(text.length / 4) * 4, tail = file.subarray(20 + size), glb = Buffer.alloc(20 + padded + tail.length, 32);
  file.copy(glb, 0, 0, 12); glb.writeUInt32LE(glb.length, 8); glb.writeUInt32LE(padded, 12); glb.writeUInt32LE(0x4e4f534a, 16); text.copy(glb, 20); tail.copy(glb, 20 + padded);
  return new GLTFLoader().parseAsync(glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength), '');
}

// Our rig (glTF asset frame, +X forward, identity rest frames), from char.courier-female.
// Skeleton v2 inserts the Mesh2Motion chain: torso = spine_01, spine = spine_02, chest = spine_03, neck = neck_01,
// clavicle* = clavicle_* (positions from assets/char.courier-female-skin/build.py; world joint positions unchanged).
const joints: [string, string | null, [number, number, number]][] = [
  ['hip', null, [0, .62, 0]], ['torso', 'hip', [0, .052, 0]], ['spine', 'torso', [0, .0876, 0]], ['chest', 'spine', [0, .0876, 0]],
  ['neck', 'chest', [0, .0818, 0]], ['head', 'neck', [0, .035, 0]],
  ['clavicleL', 'chest', [0, .0708, -.045]], ['armL', 'clavicleL', [0, .012, -.141]], ['foreArmL', 'armL', [.012, -.145, -.046]], ['handL', 'foreArmL', [.012, -.137, -.03]],
  ['clavicleR', 'chest', [0, .0708, .045]], ['armR', 'clavicleR', [0, .012, .141]], ['foreArmR', 'armR', [.012, -.145, .046]], ['handR', 'foreArmR', [.012, -.137, .03]],
  ['legL', 'hip', [0, -.045, -.1]], ['shinL', 'legL', [.012, -.22, -.012]], ['footL', 'shinL', [-.018, -.177, -.013]],
  ['legR', 'hip', [0, -.045, .1]], ['shinR', 'legR', [.012, -.22, .012]], ['footR', 'shinR', [-.018, -.177, .013]],
];
const ours = new Map<string, Object3D>();
const rig = new Object3D();
for (const [name, parent, p] of joints) { const o = new Object3D(); o.name = name; o.position.set(...p); (parent ? ours.get(parent)! : rig).add(o); ours.set(name, o); }
rig.updateMatrixWorld(true);
const restWorld = (name: string) => ours.get(name)!.getWorldPosition(new Vector3());
const childOf: Record<string, string> = { armL: 'foreArmL', foreArmL: 'handL', armR: 'foreArmR', foreArmR: 'handR', legL: 'shinL', shinL: 'footL', legR: 'shinR', shinR: 'footR' };
const ourLeg = restWorld('legL').y - restWorld('footL').y;

// Source mapping: whole-bone world deltas, or limb directions (bone → child joint).
const deltaMap: Record<string, string> = { hip: 'pelvis', torso: 'spine_01', spine: 'spine_02', chest: 'spine_03', neck: 'neck_01', head: 'head', clavicleL: 'clavicle_l', clavicleR: 'clavicle_r', handL: 'hand_l', handR: 'hand_r', footL: 'foot_l', footR: 'foot_r' };
const dirMap: Record<string, [string, string]> = { armL: ['upperarm_l', 'lowerarm_l'], foreArmL: ['lowerarm_l', 'hand_l'], armR: ['upperarm_r', 'lowerarm_r'], foreArmR: ['lowerarm_r', 'hand_r'], legL: ['thigh_l', 'calf_l'], shinL: ['calf_l', 'foot_l'], legR: ['thigh_r', 'calf_r'], shinR: ['calf_r', 'foot_r'] };

interface Spec { name: string; source: string; loop?: boolean; exaggerate?: number; bob?: number; strike?: 'l' | 'r' }
const specs: Spec[] = [
  { name: 'idle', source: 'Idle_A', loop: true, exaggerate: 1.35, bob: 1.3 },
  { name: 'walk', source: 'Walk_Female', loop: true, exaggerate: 1.3, bob: 1.25 },
  { name: 'run', source: 'Run_Female', loop: true, exaggerate: 1.2, bob: 1.1 },
  { name: 'carry', source: 'Walk_Carry', loop: true, exaggerate: 1 },
  { name: 'hurt', source: 'Hit_Chest', exaggerate: 1.4 },
  // Calm seated upper body; runtime contacts solve the saddle, grips and pedals.
  { name: 'ride', source: 'Idle_A', loop: true },
  // Strikes: contact (max hand reach) is re-timed onto 20 % of the clip, the KeyframeAnimator contract.
  { name: 'unarmed-jab', source: 'Punch_Jab', exaggerate: 1.15, strike: 'l' },
  { name: 'unarmed-cross', source: 'Punch_Cross', exaggerate: 1.15, strike: 'r' },
  { name: 'bat-1', source: 'Sword_Regular_A', exaggerate: 1.05, strike: 'r' },
  { name: 'bat-2', source: 'Sword_Regular_B', exaggerate: 1.05, strike: 'r' },
  { name: 'bat-3', source: 'Sword_Regular_C', exaggerate: 1.1, strike: 'r' },
];

/** Limit the rotation of `q` relative to `reference` (both world) to `max` radians, in place. */
const clampQ = (q: Quaternion, max: number, reference: Quaternion) => { const relative = reference.clone().invert().multiply(q), angle = 2 * Math.acos(Math.min(1, Math.abs(relative.w))); if (angle > max) q.copy(reference).multiply(new Quaternion().slerp(relative, max / angle)); return q; };
const scaleQ = (q: Quaternion, k: number) => { if (k === 1) return q; const w = Math.min(1, Math.max(-1, q.w)), angle = 2 * Math.acos(Math.abs(w)), s = Math.sqrt(1 - w * w); if (s < 1e-6) return q; const axis = new Vector3(q.x, q.y, q.z).divideScalar(s).multiplyScalar(Math.sign(w) || 1); return q.setFromAxisAngle(axis, angle * k); };

const base = await load(`${checkout}/static/animations/human-base-animations.glb`);
const addon = await load(`${checkout}/static/animations/human-addon-animations.glb`);
const scene = base.scene; scene.updateMatrixWorld(true);
const bone = (name: string) => { const b = scene.getObjectByName(name) as Bone | undefined; if (!b) throw new Error(`missing source bone ${name}`); return b; };
// Neutral reference = Idle_A frame 0 (the file's rest is a T-pose whose spine/head/pelvis axes are
// not a standing neutral); spine/head/hand/foot deltas are measured from it, so our idle ≈ our rest.
const sourceRest = new Map<string, { q: Quaternion; p: Vector3 }>();
{
  const m = new AnimationMixer(scene), idle = [...base.animations].find(a => a.name === 'Idle_A')!.clone();
  idle.tracks = idle.tracks.filter(t => !/^root\./.test(t.name)); m.clipAction(idle).play(); m.setTime(0); scene.updateMatrixWorld(true);
  scene.traverse(n => sourceRest.set(n.name, { q: n.getWorldQuaternion(new Quaternion()), p: n.getWorldPosition(new Vector3()) }));
  m.stopAllAction(); m.uncacheRoot(scene);
}
// Facing conversion: mean of both toe directions (cancels foot splay) → +X.
const toeOf = (s: string) => sourceRest.get(`ball_${s}`)!.p.clone().sub(sourceRest.get(`foot_${s}`)!.p).setY(0).normalize();
const toe = toeOf('l').add(toeOf('r')).normalize();
const R = new Quaternion().setFromUnitVectors(toe, new Vector3(1, 0, 0)), Ri = R.clone().invert();
const srcLeg = sourceRest.get('thigh_l')!.p.distanceTo(sourceRest.get('calf_l')!.p) + sourceRest.get('calf_l')!.p.distanceTo(sourceRest.get('foot_l')!.p);
const legScale = ourLeg / srcLeg;
const leftSide = sourceRest.get('hand_l')!.p.clone().applyQuaternion(R).z;
if (leftSide > 0) throw new Error('source left side maps to +Z; mirror handling not implemented');

const mixer = new AnimationMixer(scene);
const library: { name: string; duration: number; source: string; tracks: { node: string; path: string; times: number[]; values: number[] }[] }[] = [];
for (const spec of specs) {
  const clip = [...base.animations, ...addon.animations].find(a => a.name === spec.source) as AnimationClip | undefined;
  if (!clip) throw new Error(`missing clip ${spec.source}`);
  // Strip root motion tracks from the source; the sim owns travel.
  clip.tracks = clip.tracks.filter(t => !/^root\./.test(t.name));
  mixer.stopAllAction(); const action = mixer.clipAction(clip); action.reset().play();
  const fps = 60, frames = Math.max(2, Math.round(clip.duration * fps));
  const sample = (t: number) => { mixer.setTime(t); scene.updateMatrixWorld(true); };
  // Re-phase loops: left heel strike (left foot furthest forward of the pelvis) at t = 0.
  let shift = 0;
  if (spec.loop && /walk|run/.test(spec.name)) {
    let best = -Infinity;
    for (let i = 0; i < frames; i++) { sample(i / fps); const d = bone('foot_l').getWorldPosition(new Vector3()).sub(bone('pelvis').getWorldPosition(new Vector3())).applyQuaternion(R).x; if (d > best) { best = d; shift = i; } }
  }
  let contact = -1;
  if (spec.strike) {
    let best = -Infinity; const reach = { l: 0, r: 0 };
    for (let i = 0; i <= frames; i++) {
      sample(Math.min(clip.duration, i / fps));
      for (const side of ['l', 'r'] as const) { const d = bone(`hand_${side}`).getWorldPosition(new Vector3()).sub(bone('pelvis').getWorldPosition(new Vector3())).applyQuaternion(R).x; reach[side] = Math.max(reach[side], d); if (side === spec.strike && d > best) { best = d; contact = i; } }
    }
    if (spec.name.startsWith('unarmed-') && reach[spec.strike] < reach[spec.strike === 'l' ? 'r' : 'l']) throw new Error(`${spec.source}: striking hand is not ${spec.strike}`);
  }
  const pelvis0 = sourceRest.get('pelvis')!.p;
  const tracks = new Map<string, number[]>(), times: number[] = [];
  const hipPositions: Vector3[] = [];
  const world = new Map<string, Quaternion>();
  for (let i = 0; i <= frames; i++) {
    const t = ((i + shift) % frames) / fps; sample(spec.loop ? t : Math.min(clip.duration, i / fps));
    const end = frames / fps, at = i / fps;
    times.push(+(contact > 0 ? i <= contact ? at / (contact / fps) * .2 * end : .2 * end + (at - contact / fps) / (end - contact / fps) * .8 * end : at).toFixed(5));
    world.clear();
    const delta = (src: string) => R.clone().multiply(bone(src).getWorldQuaternion(new Quaternion()).multiply(sourceRest.get(src)!.q.clone().invert())).multiply(Ri);
    for (const [node, src] of Object.entries(deltaMap)) world.set(node, delta(src));
    if (spec.name === 'ride') for (const node of ['hip', 'torso', 'spine', 'chest', 'clavicleL', 'clavicleR']) world.get(node)!.identity();
    for (const [node, [a, b]] of Object.entries(dirMap)) {
      const dir = bone(b).getWorldPosition(new Vector3()).sub(bone(a).getWorldPosition(new Vector3())).applyQuaternion(R).normalize();
      // Chibi torso is wide: keep the upper arm at least as far out as our rest abduction.
      if (/^arm/.test(node)) { const side = node.endsWith('L') ? -1 : 1, rest = restWorld(childOf[node]).sub(restWorld(node)).normalize(); if (dir.z * side < rest.z * side) { dir.z = rest.z; dir.normalize(); } }
      const rest = restWorld(childOf[node]).sub(restWorld(node)).normalize();
      world.set(node, new Quaternion().setFromUnitVectors(rest, dir));
    }
    // Exaggerate upper body / pelvis rotations relative to rest for the cartoon read.
    // Arms carry the cartoon exaggeration; pelvis/chest twist stays at the mocap amount (a twisted
    // chibi torso reads as wobble, the bag swings with it).
    for (const node of ['armL', 'armR', 'foreArmL', 'foreArmR']) scaleQ(world.get(node)!, spec.exaggerate ?? 1);
    // Chibi heads are ~1/3 of the figure: keep the face readable (half the source head motion). The neck carries
    // 45 % of the head's turn relative to the chest, so large bat-swing head turns spread over the neck skin.
    // Shoulders shrug at half the source clavicle motion, at most 20° (wide chibi torso).
    scaleQ(world.get('head')!, .5); world.get('neck')!.copy(world.get('chest')!).slerp(world.get('head')!, .45);
    for (const node of ['clavicleL', 'clavicleR']) clampQ(scaleQ(world.get(node)!, .5), 20 * Math.PI / 180, new Quaternion());
    // Local = parentWorld^-1 * world (rest frames are identity in the asset frame).
    for (const [name, parent] of joints.map(j => [j[0], j[1]] as const)) {
      const local = (parent ? world.get(parent)!.clone().invert() : new Quaternion()).multiply(world.get(name)!).normalize();
      const values = tracks.get(name) ?? []; values.push(local.x, local.y, local.z, local.w); tracks.set(name, values);
    }
    // Height anchored to the lower foot (independent of root offsets), sway in the facing frame.
    const pelvis = bone('pelvis').getWorldPosition(new Vector3()), hp = pelvis.clone().sub(pelvis0).applyQuaternion(R).multiplyScalar(legScale);
    hp.y = pelvis.y * legScale; hipPositions.push(hp);
  }
  // Hip travel: remove loop drift (linear trend), scale bob.
  // Vertical: loops bob around their cycle mean (flight phases must not read as a crouch; runtime
  // plantLocomotion lowers the pelvis as far as the stride needs); one-shots start from their frame 0.
  const first = hipPositions[0], last = hipPositions[hipPositions.length - 1];
  const mean = hipPositions.reduce((a, p, i) => a.add(p.clone().sub(last.clone().sub(first).multiplyScalar(i / (hipPositions.length - 1)))), new Vector3()).divideScalar(hipPositions.length);
  const hip: number[] = [];
  hipPositions.forEach((p, i) => { const k = i / (hipPositions.length - 1), q = p.clone(); if (spec.loop) q.sub(last.clone().sub(first).multiplyScalar(k)); if (spec.loop) q.sub(mean); else q.sub(first); q.y *= spec.bob ?? 1; if (spec.name === 'ride') q.set(0, 0, 0); hip.push(+q.x.toFixed(5), +q.y.toFixed(5), +q.z.toFixed(5)); });
  const out = [{ node: 'hip', path: 'translation', times, values: hip }];
  // 1e-4 per quaternion component (≈ 0.01°): the 21-joint library stays small enough for its chunk.
  for (const [node, values] of tracks) out.push({ node, path: 'rotation', times, values: values.map(v => +v.toFixed(4)) });
  // Loops must close exactly.
  library.push({ name: spec.name, duration: frames / fps, source: `mesh2motion:${spec.source}`, tracks: out });
  console.log(spec.name, '←', spec.source, frames, 'frames', 'shift', shift, 'contact', contact);
}
writeFileSync('src/render/characters/library.skin.json', JSON.stringify(library) + '\n');
console.log(JSON.stringify({ legScale: +legScale.toFixed(3), clips: library.length }));
