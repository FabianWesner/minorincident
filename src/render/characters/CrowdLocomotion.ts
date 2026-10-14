import { Group, Matrix4, Object3D, Quaternion, Vector3 } from 'three';
import type { CrowdClip } from '../../assets/crowd';
import { GroundContacts } from './GroundContacts';
import { updateWorldTranslation } from './updateWorldTranslation';
import type { CharacterRig } from './rig';
import { cadenceStride, gaitShape, strides } from './clips';
import { PawContacts } from './PawContacts';
import { CourierGroundContacts, type GaitStyle } from './CourierGroundContacts';
import type { CrowdPosePalette } from './CrowdPosePalette';

/** Presentation-only pose layers on top of the baked clip (zombie move set, hunch). Body space: +x forward, +z lateral. */
export interface CrowdLayers {
  /** Forward hunch about the hips (rad) and side roll (rad). */
  lean?: number; roll?: number;
  /** Flinch 0..1 away from a hit coming along (hitX, hitZ) in body space. */
  flinch?: number; hitX?: number; hitZ?: number;
  /** Pelvis lunge forward over the planted feet (m, negative coils back). */
  lunge?: number;
  /** Lurching torso: weight 0..1, rolls and pitches with the gait phase. */
  lurch?: number;
  /** Seconds into the gorilla chest-beat telegraph. */
  chestBeat?: number;
  trunkSwipe?: number;
  throwPose?: number;
}
/** Clips that stand on their feet: footwork locks the feet and turns become steps. */
const standingClips = new Set(['idle', 'infected-idle', 'infected-search', 'npc-look-around', 'npc-gesture', 'npc-water', 'npc-wave', 'npc-glance', 'npc-give', 'npc-sign', 'npc-wave-in', 'npc-bang', 'npc-plead', 'npc-press', 'npc-hug', 'ff-pry', 'npc-stand-back', 'shoot', 'civ-startle', 'windup', 'swing', 'hurt']);
/** Crowd gait styles: stance (cycle fraction), run blend, knee scale. Shorter stance at speed keeps chibi legs within reach. */
const gaitStyles: Record<string, { stance: number; run: number; knee?: number }> = {
  walk: { stance: .55, run: 0 }, 'npc-walk': { stance: .55, run: 0 }, 'npc-walk-relaxed': { stance: .56, run: 0, knee: .9 }, 'npc-carry': { stance: .56, run: 0, knee: .9 }, 'npc-cane': { stance: .6, run: 0, knee: .8 },
  shamble: { stance: .6, run: 0, knee: .8 }, 'infected-frail': { stance: .5, run: .35, knee: .85 }, 'infected-lurch': { stance: .3, run: .85 }, 'infected-sprint': { stance: .26, run: 1, knee: 1.1 },
  run: { stance: .3, run: 1 }, 'infected-run': { stance: .3, run: 1 }, 'civ-flee': { stance: .3, run: 1 },
};
const correctedJoints = new Set(['hip', 'torso', 'head', 'legL', 'legR', 'shinL', 'shinR', 'footL', 'footR']);
const Z = new Vector3(0, 0, 1), X = new Vector3(1, 0, 0);
interface Footwork { contacts: CourierGroundContacts; owner: CrowdLocomotion; time: number; weight: number; active: number; run: number; stance: number }
/** Per-figure footwork shared by every LOD batch of one crowd, with a per-frame budget of fully solved figures. */
export class CrowdFootwork {
  readonly states = new Map<number, Footwork>();
  readonly far = new Map<number, { contacts: GroundContacts; owner: CrowdLocomotion; time: number }>();
  private frame = 0;
  private admitted = 0;
  get frameId(): number { return this.frame; }
  /** Figures solved this frame (tests and perf probes). */
  count = 0;
  constructor(public cap = 64) {}
  begin(time: number): void { this.frame++; this.admitted = 0; this.count = 0; this.prune(time); }
  /** Figures already stepping keep their slot; newcomers enter while the budget allows. */
  admit(id: number): boolean {
    const state = this.states.get(id), held = !!state && state.active >= this.frame - 1 && state.weight > 0;
    if (this.admitted >= (held ? this.cap * 1.5 : this.cap)) return false;
    this.admitted++; return true;
  }
  mark(state: Footwork): void { state.active = this.frame; this.count++; }
  /** Drop figures that have not been drawn for a while (removed, culled, LOD-switched away). */
  private prune(time: number): void {
    if (this.frame % 120 !== 0) return;
    for (const [id, s] of this.states) if (time - s.time > 2 || time < s.time) this.states.delete(id);
    for (const [id, s] of this.far) if (time - s.time > 2 || time < s.time) this.far.delete(id);
  }
}

/** One small off-scene skeleton per batch; figures retain only their contact
 * state. The scene still contains instanced meshes, never per-person actors. */
export class CrowdLocomotion {
  private readonly frame = new Group();
  private readonly nodes: Object3D[];
  private readonly parents: number[];
  private readonly restParents: Matrix4[];
  private readonly world: Matrix4[];
  private readonly parentInverses = new Map<number, Matrix4>();
  private readonly inverse = new Matrix4();
  private readonly scale = new Vector3();
  private readonly point = new Vector3();
  private readonly rotation = new Quaternion();
  private readonly rig: CharacterRig;
  private readonly contacts = new Map<number, GroundContacts>();
  private readonly heldPoses = new Map<number, { clip: string; frame: number; instance: Matrix4; time: number; seen: number }>();
  private prunedAt = -1;
  private readonly paws = new Map<number, PawContacts>();
  private readonly animal: boolean;
  private readonly groundedAnimal: boolean;
  private readonly preserveAnimalJoints: boolean;
  private readonly rest: { position: Vector3; quaternion: import('three').Quaternion; scale: Vector3 }[];
  readonly reach: number;
  /** Rest ankle height in foot-local units (sole contact offset for probes). */
  readonly sole: number;
  constructor(private readonly model: Object3D, private readonly clip: CrowdClip, readonly footwork = new CrowdFootwork()) {
    this.animal = !!model.getObjectByName('legFL');
    this.groundedAnimal = this.animal && model.getObjectByName('root')?.userData.groundedAnimal === true;
    this.preserveAnimalJoints = model.getObjectByName('root')?.userData.ss_preserveAnimalJoints === true;
    model.updateMatrixWorld(true);
    const originals = clip.parts.map(name => model.getObjectByName(name)!);
    this.nodes = originals.map(node => {
      const copy = new Object3D(); copy.name = node.name;
      // These private pose bones only use quaternions. Euler synchronization would convert every bone again.
      copy.quaternion._onChange(() => {});
      // Rigid decorations only inherit their atlas matrix; contacts/layers never modify their TRS.
      copy.matrixAutoUpdate = this.animal || correctedJoints.has(node.name);
      return copy;
    });
    this.parents = originals.map(node => originals.indexOf(node.parent!));
    for (const parent of this.parents) if (parent >= 0 && !this.parentInverses.has(parent)) this.parentInverses.set(parent, new Matrix4());
    this.restParents = originals.map(node => node.parent?.matrixWorld.clone() ?? new Matrix4());
    this.world = originals.map(node => node.matrixWorld.clone());
    this.rest = originals.map(node => ({ position: node.position.clone(), quaternion: node.quaternion.clone(), scale: node.scale.clone() }));
    this.nodes.forEach((node, i) => {
      const parent = this.parents[i]; (parent < 0 ? this.frame : this.nodes[parent]).add(node);
      if (parent < 0) this.world[i].decompose(node.position, node.quaternion, node.scale);
      else { node.position.copy(this.rest[i].position); node.quaternion.copy(this.rest[i].quaternion); node.scale.copy(this.rest[i].scale); }
      if (!node.matrixAutoUpdate) node.updateMatrix();
    });
    this.rig = Object.fromEntries(this.nodes.map(node => [node.name, node])) as CharacterRig;
    // The instance frame supplies heading and world scale; internal GLB scale remains on the skeleton.
    this.rig.root = this.frame;
    this.frame.updateMatrixWorld(true);
    this.reach = this.rig.legL && this.rig.shinL && this.rig.footL
      ? this.rig.legL.getWorldPosition(new Vector3()).distanceTo(this.rig.shinL.getWorldPosition(new Vector3())) + this.rig.shinL.getWorldPosition(new Vector3()).distanceTo(this.rig.footL.getWorldPosition(new Vector3())) : 0;
    this.sole = this.rig.footL && this.rig.hip ? this.rig.footL.getWorldPosition(new Vector3()).y / this.rig.hip.parent!.getWorldScale(new Vector3()).y : 0;
  }
  stance(name: string, stride: number, rootScale = 1): number { return Math.min(gaitShape[name]?.stance ?? .5, this.reach * rootScale * .75 / Math.max(.001, stride)); }
  /** Contact geometry is measured from rest, never from another figure's pose. */
  private toRest(): void {
    this.frame.matrixAutoUpdate = true; this.frame.position.set(0, 0, 0); this.frame.quaternion.identity(); this.frame.scale.setScalar(1);
    this.nodes.forEach((node, i) => {
      node.position.copy(this.rest[i].position); node.quaternion.copy(this.rest[i].quaternion); node.scale.copy(this.rest[i].scale);
      if (this.parents[i] < 0) { node.updateMatrix(); this.inverse.copy(this.restParents[i]).multiply(node.matrix).decompose(node.position, node.quaternion, node.scale); }
      if (!node.matrixAutoUpdate) node.updateMatrix();
    });
    this.frame.updateMatrixWorld(true);
  }
  private load(pose: Float32Array, instance: Matrix4, layers?: CrowdLayers, phase = 0): void {
    this.nodes.forEach((_, i) => this.world[i].fromArray(pose, i * 16));
    // Siblings share a parent pose; invert it once for this figure.
    for (const [parent, inverse] of this.parentInverses) inverse.copy(this.world[parent]).invert();
    this.nodes.forEach((node, i) => {
      const parent = this.parents[i];
      node.matrixAutoUpdate = this.animal || correctedJoints.has(node.name);
      if (parent < 0) this.inverse.identity(); else this.inverse.copy(this.parentInverses.get(parent)!);
      this.inverse.multiply(this.world[i]);
      if (node.matrixAutoUpdate) this.inverse.decompose(node.position, node.quaternion, node.scale);
      else { node.matrix.copy(this.inverse); node.matrixWorldNeedsUpdate = true; }
    });
    this.frame.matrixAutoUpdate = false; this.frame.matrix.copy(instance); this.frame.matrixWorldNeedsUpdate = true;
    if (layers) {
      // Layers only read the hip ancestor scale. Refresh that short chain before
      // applying them, then expand the complete posed hierarchy exactly once.
      this.rig.hip?.parent?.updateWorldMatrix(true, false);
      this.layer(layers, phase);
    }
    this.frame.updateMatrixWorld(true);
  }
  private store(pose: Float32Array, instance: Matrix4): void {
    this.inverse.copy(instance).invert();
    const m = this.inverse.elements;
    // Ordinary instance frames have yaw and translation only. Preserve the
    // general inverse above, but avoid multiplying known zeros for every part.
    if (m[1] === 0 && m[3] === 0 && m[4] === 0 && m[5] === 1 && m[6] === 0 && m[7] === 0 && m[9] === 0 && m[11] === 0 && m[15] === 1) {
      for (let i = 0; i < this.nodes.length; i++) {
        const w = this.nodes[i].matrixWorld.elements, offset = i * 16;
        for (let column = 0; column < 12; column += 4) {
          pose[offset + column] = (m[0] * w[column] + 0) + m[8] * w[column + 2] + 0;
          pose[offset + column + 1] = w[column + 1] + 0;
          pose[offset + column + 2] = (m[2] * w[column] + 0) + m[10] * w[column + 2] + 0;
          pose[offset + column + 3] = 0;
        }
        pose[offset + 12] = (m[0] * w[12] + 0) + m[8] * w[14] + m[12];
        pose[offset + 13] = w[13] + m[13];
        pose[offset + 14] = (m[2] * w[12] + 0) + m[10] * w[14] + m[14];
        pose[offset + 15] = 1;
      }
    } else this.nodes.forEach((node, i) => this.world[i].multiplyMatrices(this.inverse, node.matrixWorld).toArray(pose, i * 16));
  }
  /** Zombie moves and hunch as rotations/offsets in the hip parent's space (+x forward, +z lateral). */
  private layer(layers: CrowdLayers, phase: number): void {
    const { hip, torso, head } = this.rig;
    if (!hip || !torso) return;
    // Ordinary contacts never alter the arms. Retain their atlas matrices;
    // special upper-body layers acquire TRS only when they actually change it.
    if (layers.throwPose || layers.chestBeat) for (const node of [this.rig.armL, this.rig.armR, this.rig.foreArmL, this.rig.foreArmR]) {
      if (node && !node.matrixAutoUpdate) { node.matrix.decompose(node.position, node.quaternion, node.scale); node.matrixAutoUpdate = true; }
    }
    const parentScale = this.scale.setFromMatrixScale(hip.parent!.matrixWorld).y / this.scale.setFromMatrixScale(this.frame.matrixWorld).y || 1;
    const lean = layers.lean ?? 0, roll = layers.roll ?? 0, flinch = layers.flinch ?? 0, lunge = layers.lunge ?? 0, lurch = layers.lurch ?? 0;
    if (lean || roll) hip.quaternion.premultiply(this.rotation.setFromAxisAngle(Z, -lean)).premultiply(this.rotation.setFromAxisAngle(X, roll));
    if (lunge) { hip.position.x += lunge / parentScale; torso.quaternion.premultiply(this.rotation.setFromAxisAngle(Z, -Math.max(-.6, Math.min(.6, lunge * 1.6)))); }
    if (lurch) {
      // Lurch: the torso throws its weight over each landing foot and pitches on the push-off.
      const swing = Math.sin(phase * Math.PI * 2), push = Math.abs(Math.cos(phase * Math.PI * 2));
      torso.quaternion.premultiply(this.rotation.setFromAxisAngle(X, swing * .16 * lurch)).premultiply(this.rotation.setFromAxisAngle(Z, -(.1 + .1 * push) * lurch));
      head?.quaternion.premultiply(this.rotation.setFromAxisAngle(X, -swing * .1 * lurch));
    }
    if (layers.trunkSwipe !== undefined && layers.trunkSwipe !== 0) {
      const trunk = this.model.getObjectByName('trunk');
      trunk?.rotateY(layers.trunkSwipe);
    }
    if (layers.throwPose) {
      for (const arm of [this.rig.armL, this.rig.armR]) arm?.quaternion.premultiply(this.rotation.setFromAxisAngle(Z, -layers.throwPose));
    }
    if (layers.chestBeat) {
      const t = layers.chestBeat, weight = Math.min(1, t * 6);
      for (const [arm, forearm, side] of [[this.rig.armL, this.rig.foreArmL, 1], [this.rig.armR, this.rig.foreArmR, -1]] as const) {
        const beat = Math.sin(t * Math.PI * 8 + (side > 0 ? 0 : Math.PI));
        arm?.quaternion.premultiply(this.rotation.setFromAxisAngle(Z, -.6 * weight)).premultiply(this.rotation.setFromAxisAngle(X, side * .7 * weight));
        forearm?.quaternion.premultiply(this.rotation.setFromAxisAngle(Z, (-1.2 + beat * .25) * weight));
      }
    }
    if (flinch) {
      // Recoil away from the hit: chest and head snap back along the hit, hips give a little.
      const x = layers.hitX ?? -1, z = layers.hitZ ?? 0;
      torso.quaternion.premultiply(this.rotation.setFromAxisAngle(Z, -x * .42 * flinch)).premultiply(this.rotation.setFromAxisAngle(X, z * .32 * flinch));
      head?.quaternion.premultiply(this.rotation.setFromAxisAngle(Z, -x * .3 * flinch)).premultiply(this.rotation.setFromAxisAngle(X, z * .25 * flinch));
      hip.position.x += x * .04 * flinch / parentScale; hip.position.z += z * .04 * flinch / parentScale;
    }
  }
  /** Legacy stance plants (mid band): world-space stance heels, no yaw lock or turn steps. */
  correct(id: number, pose: Float32Array, instance: Matrix4, phase: number, name: string, scale: number, speed: number, layers?: CrowdLayers, time?: number): void {
    // Authored long articulated legs (zebra) stay attached at their shoulder/hip.
    // Their atlas grounds the complete pose; single-joint paw translation cannot preserve those pivots.
    if (this.animal && this.preserveAnimalJoints) return;
    if (!layers && !this.animal && (!this.reach || !gaitShape[name])) return;
    let contacts = this.contacts.get(id);
    if (!contacts && !this.animal && gaitShape[name]) { this.toRest(); contacts = new GroundContacts(this.rig); this.contacts.set(id, contacts); }
    const previous = this.footwork.far.get(id);
    if (contacts && previous && previous.owner !== this && time !== undefined && time - previous.time <= .3) {
      const left = previous.contacts.contact(0), right = previous.contacts.contact(1);
      if (left && right) contacts.inherit(phase, [left, right]);
    }
    this.load(pose, instance, layers, phase);
    const stride = cadenceStride(this.animal ? 'corgi-trot' : name, scale, speed), run = /run|sprint|flee/.test(name) ? 1 : 0;
    if (this.animal) {
      let paws = this.paws.get(id);
      if (!paws) { paws = new PawContacts(this.frame, this.model); this.paws.set(id, paws); }
      if (speed > .06 && strides[name]) paws.update(phase, stride, 'corgi-trot');
      else paws.hold(1 / 60, this.groundedAnimal);
    } else if (contacts && strides[name] && speed > .06) contacts.update(phase, stride, run, 1, this.stance(name, stride, this.scale.setFromMatrixScale(this.frame.matrixWorld).y), true);
    if (contacts && time !== undefined) this.footwork.far.set(id, { contacts, owner: this, time });
    // Humans always keep the sole correction; large authored quadrupeds retain it after paw/contact pose layers.
    if (!this.animal || (this.groundedAnimal && (gaitStyles[name] || standingClips.has(name)))) this.ground();
    this.store(pose, instance);
  }
  /** Pose layers (hunch, lunge, flinch) pivot the legs with the pelvis: lift the pelvis by whatever heel or toe they
   * pushed under the floor (QA: infected feet 2-6 cm under the floor at melee range). Same sole points as the probe. */
  private ground(): void {
    const { hip, footL, footR } = this.rig;
    if (!hip || !footL || !footR || !this.sole) return;
    const floor = this.frame.matrixWorld.elements[13];
    let deficit = 0;
    for (const foot of [footL, footR]) for (const x of [-.05, .085]) deficit = Math.max(deficit, floor - this.point.set(x, -this.sole, 0).applyMatrix4(foot.matrixWorld).y);
    if (deficit > 1e-4) { hip.position.y += deficit / this.scale.setFromMatrixScale(hip.parent!.matrixWorld).y; updateWorldTranslation(hip); }
  }
  reset(id: number): void { this.contacts.get(id)?.reset(); this.paws.get(id)?.reset(); }
  /**
   * Displayed atlas row for one figure. Near the camera (`near`, within the footwork budget) the courier's
   * footwork runs: world-locked feet with yaw, step turns, knee-profile swings, pelvis over the support leg.
   * Further out moving figures keep the stance plants; standing far figures show the baked clip.
   */
  present(id: number, poses: CrowdPosePalette, frame: number, blend: [number, number], clip: string, phase: number, instance: Matrix4, scale: number, speed: number, time: number, near: boolean, layers?: CrowdLayers, style?: GaitStyle, procedural = true, cadence = 1): number {
    const step = this.footwork.frameId;
    if (step % 120 === 0 && step !== this.prunedAt) {
      this.prunedAt = step;
      for (const [key, pose] of this.heldPoses) if (time < pose.seen || time - pose.seen > 2) this.heldPoses.delete(key);
    }
    const previous = this.heldPoses.get(id);
    const a = instance.elements, b = previous?.instance.elements;
    const barelyMoved = cadence > 1 && b && (a[12] - b[12]) ** 2 + (a[13] - b[13]) ** 2 + (a[14] - b[14]) ** 2 <= .05 ** 2;
    if (procedural && cadence > 1 && barelyMoved && previous && previous.clip === clip && time > previous.time && time - previous.time < 1 / 40 && step % cadence !== id % cadence) {
      // Hold the complete world pose, so even between solves a planted foot cannot slide with the root.
      const contacts = this.footwork.states.get(id);
      if (contacts && this.footwork.admit(id)) contacts.active = step;
      instance.copy(previous.instance); poses.reuse(id, previous.frame); blend[1] = 1; previous.seen = time;
      return previous.frame;
    }
    const result = this.solve(id, poses, frame, blend, clip, phase, instance, scale, speed, time, near, layers, style, procedural);
    if (procedural && cadence > 1) {
      const held = previous ?? { clip, frame: result, instance: new Matrix4(), time, seen: time };
      held.clip = clip; held.frame = result; held.instance.copy(instance); held.time = held.seen = time; this.heldPoses.set(id, held);
    } else this.heldPoses.delete(id);
    return result;
  }
  private solve(id: number, poses: CrowdPosePalette, frame: number, blend: [number, number], clip: string, phase: number, instance: Matrix4, scale: number, speed: number, time: number, near: boolean, layers?: CrowdLayers, style?: GaitStyle, procedural = true): number {
    if (!procedural) {
      this.footwork.states.delete(id); this.footwork.far.delete(id); this.reset(id);
      // The caller tags the pose mode so entering/leaving the baked band uses the usual TRS transition.
      if (blend[1] < 1) { const row = poses.correct(id, frame, blend[0], blend[1], () => {}); blend[1] = 1; return row; }
      return frame;
    }
    const grounded = !this.animal && !!this.reach && (!!gaitStyles[clip] || standingClips.has(clip));
    let state = this.footwork.states.get(id);
    if (state && (time < state.time || time - state.time > .3)) { this.footwork.states.delete(id); state = undefined; }
    const want = near && grounded && this.footwork.admit(id);
    if (!near && state && gaitShape[clip]) {
      // Fading the leg solve lets a planted shoe slide toward the baked stride. Transfer its world contacts to the
      // cheaper solver instead, retaining the footwork budget for figures that are still near the camera.
      let contacts = this.contacts.get(id);
      if (!contacts) { this.toRest(); contacts = new GroundContacts(this.rig); this.contacts.set(id, contacts); }
      contacts.inherit(phase, [state.contacts.contact(0), state.contacts.contact(1)]);
      this.footwork.states.delete(id); state = undefined;
    }
    if (want || state) {
      if (!state) {
        const previous = this.footwork.far.get(id);
        const far = previous && time - previous.time <= .3 ? previous.contacts : undefined, left = far?.contact(0), right = far?.contact(1);
        // A newly visible figure plants at its currently drawn foot positions.
        // Blending that first solve lets those contacts slide before they lock.
        this.toRest(); state = { contacts: new CourierGroundContacts(this.rig, this.rig.hip.parent!), owner: this, time, weight: 1, active: 0, run: gaitStyles[clip]?.run ?? 0, stance: gaitStyles[clip]?.stance ?? .55 };
        if (left && right) state.contacts.inherit(phase, [left, right]);
        this.footwork.far.delete(id);
        this.footwork.states.set(id, state);
      }
      this.contacts.get(id)?.reset();
      if (state.owner !== this) { state.contacts.rebind(this.rig, this.rig.hip.parent!); state.owner = this; }
      const dt = Math.min(.1, time - state.time); state.time = time;
      state.weight = Math.max(0, Math.min(1, state.weight + (want ? 1 : -1) * Math.max(dt, 1e-3) / .12));
      if (state.weight > 0) {
        this.footwork.mark(state);
        const footwork = state, gait = gaitStyles[clip], moving = !!gait && speed > .06;
        // Walk/run clip switches blend the gait shape (stance, knee flex) over ~0.15 s instead of jumping.
        if (gait) { const k = 1 - Math.exp(-dt / .15); state.run += (gait.run - state.run) * k; state.stance += (gait.stance - state.stance) * k; }
        const row = poses.correct(id, frame, blend[0], blend[1], pose => {
          this.load(pose, instance, layers, phase);
          const stride = moving ? cadenceStride(clip, scale, speed) : 0;
          // load() and layer() have already refreshed the complete rig.
          footwork.contacts.update(moving ? phase : 0, stride, footwork.run, footwork.weight, moving ? speed : 0, dt, { stance: footwork.stance, knee: gait?.knee, maxSwing: .4, ...style }, true);
          this.ground();
          this.store(pose, instance);
        });
        // Never draw a broken solve: a non-finite pose collapses the figure to nothing on the GPU. Drop the
        // contacts (they restart fresh) and show the baked clip pose this frame.
        if (!poses.finite(row)) { this.footwork.states.delete(id); const baked = poses.correct(id, frame, blend[0], blend[1], () => {}); blend[1] = 1; return baked; }
        blend[1] = 1; return row;
      }
      this.footwork.states.delete(id);
    }
    if ((strides[clip] && speed > .06) || layers || this.animal && !this.preserveAnimalJoints && standingClips.has(clip)) {
      const row = poses.correct(id, frame, blend[0], blend[1], pose => this.correct(id, pose, instance, phase, clip, scale, speed, layers, time));
      blend[1] = 1; return row;
    }
    this.reset(id);
    if (blend[1] < 1) { const row = poses.correct(id, frame, blend[0], blend[1], () => {}); blend[1] = 1; return row; }
    return frame;
  }
}
