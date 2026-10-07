import { AnimationClip, AnimationMixer, Box3, Mesh, Quaternion, QuaternionKeyframeTrack, VectorKeyframeTrack, Vector3, LoopOnce, type Object3D } from 'three';
import type { AnimationState } from '../../data/survivor';
import library from './library.json';
import skinLibrary from './library.skin.json';
import type { CharacterRig } from './rig';

/** Blender GLB samplers compiled by tools/assets/animation-library.ts. */
export const authoredClips = new Map(library.map(clip => [clip.name, clip]));
/** Skin pilot: Mesh2Motion CC0 clips retargeted offline (tools/skinpilot/retarget.ts); same schema, overrides by name. */
export const skinClips: typeof authoredClips = new Map(skinLibrary.map(clip => [clip.name, clip as unknown as (typeof library)[number]]));
export const strides: Record<string, number> = { walk: .9, run: 1.17, shamble: .9, 'infected-run': 1.17, 'npc-walk': .9, 'npc-walk-relaxed': .9, 'npc-carry': .9, 'npc-cane': .9, 'corgi-walk': .55, 'corgi-trot': .8,
  // E19 §5.4 tiers read from cadence: frail chops short quick steps, the lurch is
  // medium, the athletic sprint covers ground in long low strides.
  'infected-frail': .95, 'infected-lurch': 1.25, 'infected-sprint': 1.75, 'civ-flee': 1.25, 'corgi-gallop': 1.1, ride: 3.2 };
/** Skin pilot gait: longer strides at a calmer cadence (the library run cycles ~5×/s at 4.5 m/s on
 * chibi legs and reads as scurrying/vibration); raw strides before the rig's leg proportion. */
export const skinGait: Record<string, { stride: number; stance: number; lift: number }> = { walk: { stride: .9, stance: .5, lift: .008 }, run: { stride: 1.45, stance: .22, lift: .028 } };
/** Keep short authored strides from buzzing at speed; longer strides preserve planted feet as speed rises. */
export function cadenceStride(name: string, scale: number, speed: number): number {
  const authored = (strides[name] ?? 0) * scale;
  const cyclesPerSecond = name.startsWith('corgi-') ? name === 'corgi-walk' ? 2 : 2.7
    : name === 'run' || name === 'infected-run' || name === 'infected-sprint' || name === 'civ-flee' ? 2.7 : 2;
  return Math.max(authored, Math.max(0, speed) / cyclesPerSecond);
}
/** Planted support per gait: stance fraction of the cycle and swing-foot lift (m). */
export const gaitShape: Record<string, { stance: number; lift: number }> = {
  walk: { stance: .6, lift: .055 }, shamble: { stance: .6, lift: .055 }, 'npc-walk': { stance: .6, lift: .055 }, 'npc-walk-relaxed': { stance: .6, lift: .055 },
  run: { stance: .5, lift: .085 }, 'infected-run': { stance: .5, lift: .085 }, 'civ-flee': { stance: .5, lift: .08 },
  'infected-frail': { stance: .56, lift: .03 }, 'infected-lurch': { stance: .5, lift: .07 }, 'infected-sprint': { stance: .4, lift: .12 },
};
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
export function retargetClip(root: Object3D, name: string, additive = false, overrides?: typeof authoredClips): AnimationClip {
  let rest = restPoses.get(root);
  if (!rest) { rest = []; root.traverse(node => rest!.push({ node, position: node.position.clone(), quaternion: node.quaternion.clone() })); restPoses.set(root, rest); }
  const current = rest.map(({ node }) => ({ node, position: node.position.clone(), quaternion: node.quaternion.clone() }));
  for (const pose of rest) { pose.node.position.copy(pose.position); pose.node.quaternion.copy(pose.quaternion); }
  try { return buildRetargetedClip(root, name, additive, overrides?.get(name) ?? authoredClips.get(name), overrides === skinClips ? skinGait[name] : undefined, overrides === skinClips); }
  finally { for (const pose of current) { pose.node.position.copy(pose.position); pose.node.quaternion.copy(pose.quaternion); } }
}
function buildRetargetedClip(root: Object3D, name: string, additive: boolean, source = authoredClips.get(name), gait?: { stride: number; stance: number; lift: number }, skinned = false): AnimationClip {
  if (!source) throw new Error(`Missing authored clip ${name}`);
  const tracks: (QuaternionKeyframeTrack | VectorKeyframeTrack)[] = [], q = new Quaternion();
  const hipHeight = root.getObjectByName('hip')?.position.y ?? .705;
  const skinLocomotion = !!gait;
  const skinPlanted = skinned && /^(unarmed-(jab|cross|uppercut)|bat-|hurt)/.test(name);
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
          if ((skinLocomotion || skinPlanted) && nodeName === 'hip') q.slerp(new Quaternion(), skinLocomotion ? .82 : .7);
          // Forward-reaching infected need their arms beside the body and bent
          // legs lowered as the back pose settles, rather than pointing upward.
          if (/^(die|death-back)$/.test(name) && (root.getObjectByName('foreArmL')?.position.x ?? 0) > .08 && /^(arm|foreArm|leg)[LR]$/.test(nodeName)) {
            const resting = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), (nodeName.startsWith('foreArm') ? 0 : nodeName.startsWith('leg') ? -30 : -100) * Math.PI / 180);
            q.slerp(resting, Math.max(0, Math.min(1, (times[i] / source.duration - .5) * 2)));
          }
          if (!additive) q.premultiply(node.quaternion);
          values.push(q.x, q.y, q.z, q.w);
        }
        const rotation = new QuaternionKeyframeTrack(`${nodeName}.quaternion`, times, values);
        if (skinned && name.startsWith('unarmed-') && !skinClips.has(name)) softenChamber(rotation, source.duration);
        tracks.push(rotation);
      } else {
        for (let i = 0; i < times.length; i++) for (let c = 0; c < 3; c++) {
          let delta = track?.values[i * 3 + c] ?? 0;
          if (skinLocomotion && nodeName === 'hip') delta = c === 2 ? delta * .15 : 0;
          if (skinPlanted && nodeName === 'hip') delta *= .2;
          if (c === 1 && nodeName === 'hip' && groundClips.test(name)) delta *= Math.max(0, hipHeight - .15) / .55;
          values.push(delta + (additive ? 0 : node.position.getComponent(c)));
        }
        tracks.push(new VectorKeyframeTrack(`${nodeName}.position`, times, values));
      }
    }
  }
  if (!additive && !gait && gaitShape[name]) plantLocomotion(root, name, source.duration, tracks, gait);
  return new AnimationClip(name, source.duration, tracks);
}

/** Authored fallback kicks exported a held guard then a 100+ degree chamber
 * jump. A spherical quadratic uses that chamber as the anticipation control
 * pose, reaches the original contact exactly, and leaves recovery untouched. */
function softenChamber(track: QuaternionKeyframeTrack, duration: number): void {
  const from = new Quaternion(), chamber = new Quaternion();
  let jump = -1;
  for (let i = 1; i < track.times.length && track.times[i] < duration * .1; i++) {
    from.fromArray(track.values, (i - 1) * 4); chamber.fromArray(track.values, i * 4);
    if (from.angleTo(chamber) > Math.PI / 7) { jump = i; break; }
  }
  if (jump < 0) return;
  const sample = track.InterpolantFactoryMethodLinear(), contactTime = duration * .2;
  from.fromArray(track.values, 0); chamber.fromArray(track.values, jump * 4);
  const contact = new Quaternion().fromArray(sample.evaluate(contactTime));
  const times = [...new Set([0, ...track.times, contactTime])].sort((a, b) => a - b), values: number[] = [];
  const a = new Quaternion(), b = new Quaternion();
  for (const t of times) {
    if (t < contactTime) {
      const u = t / contactTime;
      a.copy(from).slerp(chamber, u).slerp(b.copy(chamber).slerp(contact, u), u);
    } else a.fromArray(sample.evaluate(t));
    a.toArray(values, values.length);
  }
  track.times = new Float32Array(times); track.values = new Float32Array(values);
}

/** Bake flat-ground support into target-specific tracks. The authored pelvis keeps
 * its weight shift/counter-rotation; each rig's actual limb lengths determine the
 * knee arc. Stance travels backwards by exactly the runtime full-cycle distance. */
function plantLocomotion(root: Object3D, name: string, duration: number, tracks: (QuaternionKeyframeTrack | VectorKeyframeTrack)[], gait?: { stride: number; stance: number; lift: number }): void {
  const hip = root.getObjectByName('hip');
  if (!hip) return;
  const hipTrack = tracks.find(t => t.name === 'hip.position')!;
  const position = hipTrack.InterpolantFactoryMethodLinear();
  const rotation = tracks.find(t => t.name === 'hip.quaternion')!.InterpolantFactoryMethodLinear();
  const { stance, lift } = gait ?? gaitShape[name], stride = (gait?.stride ?? strides[name]) * strideProportion(root);
  // A grouped NPC can have a rotated sub-root above its hip. Express actor
  // travel in that parent's coordinates, rather than sliding along its local X.
  const forward = new Vector3(1, 0, 0).applyQuaternion(root.getWorldQuaternion(new Quaternion()));
  if (hip.parent) forward.applyQuaternion(hip.parent.getWorldQuaternion(new Quaternion()).invert());
  const footTarget = (phase: number): Vector3 => {
    if (phase <= stance) return forward.clone().multiplyScalar(stride * (stance / 2 - phase));
    const t = (phase - stance) / (1 - stance);
    // Match the backward stance velocity at toe-off and heel contact.
    const smooth = t * t * (3 - 2 * t) - (1 - stance) / stance * (2 * t * t * t - 3 * t * t + t);
    return forward.clone().multiplyScalar(stride * stance * (smooth - .5)).add(new Vector3(0, Math.sin(Math.PI * t) ** 2 * lift, 0));
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
