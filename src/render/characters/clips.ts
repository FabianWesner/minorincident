import { AnimationClip, AnimationMixer, Box3, Mesh, Quaternion, QuaternionKeyframeTrack, VectorKeyframeTrack, Vector3, LoopOnce, type Object3D } from 'three';
import type { AnimationState } from '../../data/survivor';
import library from './library.json';
import type { CharacterRig } from './rig';

/** Blender GLB samplers compiled by tools/assets/animation-library.ts. */
export const authoredClips = new Map(library.map(clip => [clip.name, clip]));
export const strides: Record<string, number> = { walk: .9, run: 1.17, shamble: .9, 'infected-run': 1.17, 'npc-walk': .9, 'npc-walk-relaxed': .9, 'npc-carry': .9, 'npc-cane': .9, 'corgi-walk': .55, 'corgi-trot': .8 };
const worldScale = new Vector3(), worldOrigin = new Vector3();
/** Library humanoid rest leg (leg->shin->foot), metres; strides are authored for it. */
const libraryLeg = .516;
/** Rest-pose stride ratio in rig-local units, independent of world/model scale. */
function strideProportion(root: Object3D): number {
  const shin = root.getObjectByName('shinL'), foot = root.getObjectByName('footL');
  const leg = shin && foot && !root.getObjectByName('legFL') ? -(shin.position.y + foot.position.y) : libraryLeg;
  return leg > .2 && leg < libraryLeg ? leg / libraryLeg : 1;
}
/** World-space stride multiplier: model scale times the shorter-legged rig's
 * stride ratio. Stance baking uses only the local ratio so scaling is applied once. */
export function strideScale(root: Object3D): number {
  // GLTF scene wrappers can sit above the normalized rig root. Bone offsets
  // are in the hip parent's coordinates, including that internal asset scale.
  const frame = root.getObjectByName('hip')?.parent ?? root;
  return frame.getWorldScale(worldScale).y * strideProportion(root);
}
const groundClips = /^(die|death-|knockdown|flung|get-up|crawl|infection-collapse|infection-rise)/;
const upperBody = /^(torso|head|arm|foreArm|hand)/;

/** Retarget by name, preserving model rest TRS. Additive clips contain upper-body
 * offsets so the locomotion action retains control of planted feet. */
const restPoses = new WeakMap<Object3D, { node: Object3D; position: Vector3; quaternion: Quaternion }[]>();
/** Sampling one action must not become the rest pose of the next action. */
export function retargetClip(root: Object3D, name: string, additive = false): AnimationClip {
  let rest = restPoses.get(root);
  if (!rest) { rest = []; root.traverse(node => rest!.push({ node, position: node.position.clone(), quaternion: node.quaternion.clone() })); restPoses.set(root, rest); }
  const current = rest.map(({ node }) => ({ node, position: node.position.clone(), quaternion: node.quaternion.clone() }));
  for (const pose of rest) { pose.node.position.copy(pose.position); pose.node.quaternion.copy(pose.quaternion); }
  try { return buildRetargetedClip(root, name, additive); }
  finally { for (const pose of current) { pose.node.position.copy(pose.position); pose.node.quaternion.copy(pose.quaternion); } }
}
function buildRetargetedClip(root: Object3D, name: string, additive: boolean): AnimationClip {
  const source = authoredClips.get(name);
  if (!source) throw new Error(`Missing authored clip ${name}`);
  const tracks: (QuaternionKeyframeTrack | VectorKeyframeTrack)[] = [], q = new Quaternion();
  const hipHeight = root.getObjectByName('hip')?.position.y ?? .705;
  const contract = name === 'infected-flight' || name === 'animal-death' ? ['body','head','tail','packSocket','legFL','legFR','legBL','legBR','wingL','wingR'] : name.startsWith('corgi-') ? ['body','head','tail','packSocket','legFL','legFR','legBL','legBR'] : ['root','hip','torso','head','armL','armR','foreArmL','foreArmR','handL','handR','legL','legR','shinL','shinR','footL','footR','backpackSocket'];
  for (const nodeName of contract) {
    const node = root.getObjectByName(nodeName);
    if (!node || additive && !upperBody.test(nodeName)) continue;
    for (const path of ['rotation', 'translation'] as const) {
      const track = source.tracks.find(t => t.node === nodeName && t.path === path), times = track?.times ?? [0, source.duration];
      const values: number[] = [];
      if (path === 'rotation') {
        for (let i = 0; i < times.length; i++) {
          q.set(0, 0, 0, 1); if (track) q.fromArray(track.values, i * 4).normalize();
          // Forward-reaching infected need their arms beside the body and bent
          // legs lowered as the back pose settles, rather than pointing upward.
          if (/^(die|death-back)$/.test(name) && (root.getObjectByName('foreArmL')?.position.x ?? 0) > .08 && /^(arm|foreArm|leg)[LR]$/.test(nodeName)) {
            const resting = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), (nodeName.startsWith('foreArm') ? 0 : nodeName.startsWith('leg') ? -30 : -100) * Math.PI / 180);
            q.slerp(resting, Math.max(0, Math.min(1, (times[i] / source.duration - .5) * 2)));
          }
          if (!additive) q.premultiply(node.quaternion);
          values.push(q.x, q.y, q.z, q.w);
        }
        tracks.push(new QuaternionKeyframeTrack(`${nodeName}.quaternion`, times, values));
      } else {
        for (let i = 0; i < times.length; i++) for (let c = 0; c < 3; c++) {
          let delta = track?.values[i * 3 + c] ?? 0;
          if (c === 1 && nodeName === 'hip' && groundClips.test(name)) delta *= Math.max(0, hipHeight - .15) / .55;
          values.push(delta + (additive ? 0 : node.position.getComponent(c)));
        }
        tracks.push(new VectorKeyframeTrack(`${nodeName}.position`, times, values));
      }
    }
  }
  if (!additive && /^(walk|run|npc-walk|npc-walk-relaxed)$/.test(name)) plantLocomotion(root, name, source.duration, tracks);
  return new AnimationClip(name, source.duration, tracks);
}

/** Bake flat-ground support into target-specific tracks. The authored pelvis keeps
 * its weight shift/counter-rotation; each rig's actual limb lengths determine the
 * knee arc. Stance travels backwards by exactly the runtime full-cycle distance. */
function plantLocomotion(root: Object3D, name: string, duration: number, tracks: (QuaternionKeyframeTrack | VectorKeyframeTrack)[]): void {
  const hip = root.getObjectByName('hip');
  if (!hip) return;
  const hipTrack = tracks.find(t => t.name === 'hip.position')!;
  const position = hipTrack.InterpolantFactoryMethodLinear();
  const rotation = tracks.find(t => t.name === 'hip.quaternion')!.InterpolantFactoryMethodLinear();
  const stance = name === 'run' ? .5 : .6, stride = strides[name] * strideProportion(root);
  // A grouped NPC can have a rotated sub-root above its hip. Express actor
  // travel in that parent's coordinates, rather than sliding along its local X.
  const forward = new Vector3(1, 0, 0).applyQuaternion(root.getWorldQuaternion(new Quaternion()));
  if (hip.parent) forward.applyQuaternion(hip.parent.getWorldQuaternion(new Quaternion()).invert());
  const footTarget = (phase: number): Vector3 => {
    if (phase <= stance) return forward.clone().multiplyScalar(stride * (stance / 2 - phase));
    const t = (phase - stance) / (1 - stance);
    // Match the backward stance velocity at toe-off and heel contact.
    const smooth = t * t * (3 - 2 * t) - (1 - stance) / stance * (2 * t * t * t - 3 * t * t + t);
    return forward.clone().multiplyScalar(stride * stance * (smooth - .5)).add(new Vector3(0, Math.sin(Math.PI * t) ** 2 * (name === 'run' ? .085 : .055), 0));
  };
  // Lower the mean pelvis only as far as this rig requires for a softly bent
  // support knee. Clamping an unreachable ankle would turn support into sliding.
  let lowering = 0;
  for (const [side, offset] of [['L', 0], ['R', .5]] as const) {
    const leg = root.getObjectByName(`leg${side}`), shin = root.getObjectByName(`shin${side}`), foot = root.getObjectByName(`foot${side}`);
    if (!leg || !shin || !foot) continue;
    const ankle = hip.position.clone().add(leg.position).add(shin.position).add(foot.position);
    const reach = (shin.position.length() + foot.position.length()) * .98;
    for (let i = 0; i <= 120; i++) {
      const hq = new Quaternion().fromArray(rotation.evaluate(i / 120 * duration)).normalize();
      const hp = new Vector3().fromArray(position.evaluate(i / 120 * duration));
      const target = ankle.clone().add(footTarget((i / 120 + offset) % 1)).sub(hp).sub(leg.position.clone().applyQuaternion(hq));
      lowering = Math.max(lowering, -target.y - Math.sqrt(Math.max(0, reach * reach - target.x * target.x - target.z * target.z)));
    }
  }
  for (let i = 1; i < hipTrack.values.length; i += 3) hipTrack.values[i] -= lowering;
  for (const [side, offset] of [['L', 0], ['R', .5]] as const) {
    const leg = root.getObjectByName(`leg${side}`), shin = root.getObjectByName(`shin${side}`), foot = root.getObjectByName(`foot${side}`);
    if (!leg || !shin || !foot) continue;
    const ankle = hip.position.clone().add(leg.position).add(shin.position).add(foot.position);
    const a = shin.position.length(), b = foot.position.length();
    const times: number[] = [], thighValues: number[] = [], shinValues: number[] = [], footValues: number[] = [];
    for (let i = 0, frames = Math.round(duration * 120); i <= frames; i++) {
      const time = i / frames * duration, phase = (i / frames + offset) % 1;
      const hq = new Quaternion().fromArray(rotation.evaluate(time)).normalize();
      const hp = new Vector3().fromArray(position.evaluate(time));
      const target = ankle.clone().add(footTarget(phase)).sub(hp).applyQuaternion(hq.clone().invert()).sub(leg.position);
      const d = Math.min(a + b - .0001, target.length()), axis = target.clone().normalize();
      const along = (a * a + d * d - b * b) / (2 * d);
      const bend = forward.clone().applyQuaternion(hq.clone().invert());
      bend.addScaledVector(axis, -bend.dot(axis)).normalize();
      const knee = axis.clone().multiplyScalar(along).addScaledVector(bend, Math.sqrt(Math.max(0, a * a - along * along)));
      const thigh = new Quaternion().setFromUnitVectors(shin.position.clone().normalize(), knee.clone().normalize());
      const lower = axis.multiplyScalar(d).sub(knee).applyQuaternion(thigh.clone().invert());
      const sq = new Quaternion().setFromUnitVectors(foot.position.clone().normalize(), lower.normalize());
      const fq = hq.clone().multiply(thigh).multiply(sq).invert().multiply(foot.quaternion);
      times.push(time); thigh.toArray(thighValues, thighValues.length); sq.toArray(shinValues, shinValues.length); fq.toArray(footValues, footValues.length);
    }
    for (const [node, values] of [[leg, thighValues], [shin, shinValues], [foot, footValues]] as const) {
      const index = tracks.findIndex(t => t.name === `${node.name}.quaternion`);
      tracks[index] = new QuaternionKeyframeTrack(`${node.name}.quaternion`, times, values);
    }
  }
}

/** Deterministic sampler for crowd baking; reset actions to avoid accumulating poses. */
const samplers = new WeakMap<Object3D, { mixer: AnimationMixer; clips: Map<string, AnimationClip> }>();
const floorBounds = new WeakMap<Object3D, Mesh[]>();
const bounds = new Box3(), partBounds = new Box3();
/** Model-specific accessory thickness (especially backpacks) determines the floor
 * contact of a corpse; the shared authored joint pose itself stays unchanged. */
export function settleGroundPose(root: Object3D, resting = false): void {
  let meshes = floorBounds.get(root);
  if (!meshes) { meshes = []; root.traverse(node => { if (node instanceof Mesh) { node.geometry.computeBoundingBox(); meshes!.push(node); } }); floorBounds.set(root, meshes); }
  root.updateMatrixWorld(true); bounds.makeEmpty();
  for (const mesh of meshes) {
    let visible = true;
    for (let parent: Object3D | null = mesh; parent; parent = parent.parent) if (!parent.visible || parent.name.startsWith('stump_')) { visible = false; break; }
    if (visible && mesh.geometry.boundingBox) bounds.union(partBounds.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld));
  }
  const hip = root.getObjectByName('hip') ?? root.getObjectByName('body');
  const floor = root.getWorldPosition(worldOrigin).y + .015;
  if (hip && Number.isFinite(bounds.min.y) && (bounds.min.y < floor || resting)) { hip.position.y += (floor - bounds.min.y) / (hip.parent ?? root).getWorldScale(worldScale).y; root.updateMatrixWorld(true); }
}
export function sampleClip(root: Object3D, name: string, seconds: number): void {
  let sampler = samplers.get(root);
  if (!sampler) { sampler = { mixer: new AnimationMixer(root), clips: new Map() }; samplers.set(root, sampler); }
  let clip = sampler.clips.get(name);
  if (!clip) { sampler.mixer.stopAllAction(); clip = retargetClip(root, name); sampler.clips.set(name, clip); }
  sampler.mixer.stopAllAction();
  const action = sampler.mixer.clipAction(clip).reset().setLoop(LoopOnce, 1); action.clampWhenFinished = true; action.play();
  sampler.mixer.setTime(Math.max(0, Math.min(clip.duration, seconds)));
  if (groundClips.test(name) || name === 'animal-death') settleGroundPose(root, /^(die|death-|animal-death)/.test(name) && seconds >= clip.duration * .95);
}
export type Clip = (rig: CharacterRig, seconds: number) => void;
/** Complete sim-state contract; every evaluation uses authored glTF keyframes. */
export const clips: Record<AnimationState, Clip> = Object.fromEntries(['idle','walk','run','hurt','die','swing','shoot','throw','kick','interact','enter-car'].map(name => [name, (rig: CharacterRig, seconds: number) => sampleClip(rig.root, name, seconds)])) as Record<AnimationState, Clip>;
