import { AnimationClip, AnimationMixer, Box3, Mesh, Quaternion, QuaternionKeyframeTrack, VectorKeyframeTrack, Vector3, LoopOnce, type Object3D } from 'three';
import type { AnimationState } from '../../data/survivor';
import library from './library.json';
import type { CharacterRig } from './rig';

/** Blender GLB samplers compiled by tools/assets/animation-library.ts. */
export const authoredClips = new Map(library.map(clip => [clip.name, clip]));
export const strides: Record<string, number> = { walk: .9, run: 1.17, shamble: .9, 'infected-run': 1.17, 'npc-walk': .9, 'npc-walk-relaxed': .9, 'corgi-walk': .55, 'corgi-trot': .8 };
const worldScale = new Vector3(), worldOrigin = new Vector3();
/** Optimized character GLBs scale the shared hierarchy to their catalog height. */
export function strideScale(root: Object3D): number { return root.getWorldScale(worldScale).y; }
const groundClips = /^(die|death-|knockdown|flung|get-up|crawl|infection-collapse|infection-rise)/;
const upperBody = /^(torso|head|arm|foreArm|hand)/;

/** Retarget by name, preserving model rest TRS. Additive clips contain upper-body
 * offsets so the locomotion action retains control of planted feet. */
export function retargetClip(root: Object3D, name: string, additive = false): AnimationClip {
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
  return new AnimationClip(name, source.duration, tracks);
}

/** Deterministic sampler for crowd baking; reset actions to avoid accumulating poses. */
const samplers = new WeakMap<Object3D, { mixer: AnimationMixer; clips: Map<string, AnimationClip> }>();
const floorBounds = new WeakMap<Object3D, Mesh[]>();
const bounds = new Box3(), partBounds = new Box3();
/** Model-specific accessory thickness (especially backpacks) determines the floor
 * contact of a corpse; the shared authored joint pose itself stays unchanged. */
export function settleGroundPose(root: Object3D): void {
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
  if (hip && Number.isFinite(bounds.min.y) && bounds.min.y < floor) { hip.position.y += (floor - bounds.min.y) / strideScale(root); root.updateMatrixWorld(true); }
}
export function sampleClip(root: Object3D, name: string, seconds: number): void {
  let sampler = samplers.get(root);
  if (!sampler) { sampler = { mixer: new AnimationMixer(root), clips: new Map() }; samplers.set(root, sampler); }
  let clip = sampler.clips.get(name);
  if (!clip) { sampler.mixer.stopAllAction(); clip = retargetClip(root, name); sampler.clips.set(name, clip); }
  sampler.mixer.stopAllAction();
  const action = sampler.mixer.clipAction(clip).reset().setLoop(LoopOnce, 1); action.clampWhenFinished = true; action.play();
  sampler.mixer.setTime(Math.max(0, Math.min(clip.duration, seconds)));
  if (groundClips.test(name) || name === 'animal-death') settleGroundPose(root);
}
export type Clip = (rig: CharacterRig, seconds: number) => void;
/** Complete sim-state contract; every evaluation uses authored glTF keyframes. */
export const clips: Record<AnimationState, Clip> = Object.fromEntries(['idle','walk','run','hurt','die','swing','shoot','throw','kick','interact','enter-car'].map(name => [name, (rig: CharacterRig, seconds: number) => sampleClip(rig.root, name, seconds)])) as Record<AnimationState, Clip>;
