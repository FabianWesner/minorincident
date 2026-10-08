import { Group, Matrix4, Object3D, Quaternion, Vector3 } from 'three';
import type { CrowdClip } from '../../assets/crowd';
import { GroundContacts } from './GroundContacts';
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
}
/** Clips that stand on their feet: footwork locks the feet and turns become steps. */
const standingClips = new Set(['idle', 'infected-idle', 'infected-search', 'npc-look-around', 'npc-gesture', 'npc-water', 'npc-wave', 'npc-glance', 'npc-give', 'npc-sign', 'npc-wave-in', 'civ-startle', 'windup', 'swing', 'hurt']);
/** Crowd gait styles: stance (cycle fraction), run blend, knee scale. Shorter stance at speed keeps chibi legs within reach. */
const gaitStyles: Record<string, { stance: number; run: number; knee?: number }> = {
  walk: { stance: .55, run: 0 }, 'npc-walk': { stance: .55, run: 0 }, 'npc-walk-relaxed': { stance: .56, run: 0, knee: .9 }, 'npc-carry': { stance: .56, run: 0, knee: .9 }, 'npc-cane': { stance: .6, run: 0, knee: .8 },
  shamble: { stance: .6, run: 0, knee: .8 }, 'infected-frail': { stance: .5, run: .35, knee: .85 }, 'infected-lurch': { stance: .3, run: .85 }, 'infected-sprint': { stance: .26, run: 1, knee: 1.1 },
  run: { stance: .3, run: 1 }, 'infected-run': { stance: .3, run: 1 }, 'civ-flee': { stance: .3, run: 1 },
};
const Z = new Vector3(0, 0, 1), X = new Vector3(1, 0, 0);
interface Footwork { contacts: CourierGroundContacts; owner: CrowdLocomotion; time: number; weight: number; active: number; run: number; stance: number }
/** Per-figure footwork shared by every LOD batch of one crowd, with a per-frame budget of fully solved figures. */
export class CrowdFootwork {
  readonly states = new Map<number, Footwork>();
  private frame = 0;
  private admitted = 0;
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
  private prune(time: number): void { if (this.frame % 120 === 0) for (const [id, s] of this.states) if (time - s.time > 2 || time < s.time) this.states.delete(id); }
}

/** One small off-scene skeleton per batch; figures retain only their contact
 * state. The scene still contains instanced meshes, never per-person actors. */
export class CrowdLocomotion {
  private readonly frame = new Group();
  private readonly nodes: Object3D[];
  private readonly parents: number[];
  private readonly restParents: Matrix4[];
  private readonly world: Matrix4[];
  private readonly inverse = new Matrix4();
  private readonly scale = new Vector3();
  private readonly rotation = new Quaternion();
  private readonly rig: CharacterRig;
  private readonly contacts = new Map<number, GroundContacts>();
  private readonly paws = new Map<number, PawContacts>();
  private readonly animal: boolean;
  private readonly rest: { position: Vector3; quaternion: import('three').Quaternion; scale: Vector3 }[];
  readonly reach: number;
  /** Rest ankle height in foot-local units (sole contact offset for probes). */
  readonly sole: number;
  constructor(private readonly model: Object3D, private readonly clip: CrowdClip, readonly footwork = new CrowdFootwork()) {
    this.animal = !!model.getObjectByName('legFL');
    model.updateMatrixWorld(true);
    const originals = clip.parts.map(name => model.getObjectByName(name)!);
    this.nodes = originals.map(node => { const copy = new Object3D(); copy.name = node.name; return copy; });
    this.parents = originals.map(node => originals.indexOf(node.parent!));
    this.restParents = originals.map(node => node.parent?.matrixWorld.clone() ?? new Matrix4());
    this.world = originals.map(node => node.matrixWorld.clone());
    this.rest = originals.map(node => ({ position: node.position.clone(), quaternion: node.quaternion.clone(), scale: node.scale.clone() }));
    this.nodes.forEach((node, i) => {
      const parent = this.parents[i]; (parent < 0 ? this.frame : this.nodes[parent]).add(node);
      if (parent < 0) this.world[i].decompose(node.position, node.quaternion, node.scale);
      else { node.position.copy(this.rest[i].position); node.quaternion.copy(this.rest[i].quaternion); node.scale.copy(this.rest[i].scale); }
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
    });
    this.frame.updateMatrixWorld(true);
  }
  private load(pose: Float32Array, instance: Matrix4): void {
    this.nodes.forEach((_, i) => this.world[i].fromArray(pose, i * 16));
    this.nodes.forEach((node, i) => {
      const parent = this.parents[i];
      if (parent < 0) this.inverse.identity(); else this.inverse.copy(this.world[parent]).invert();
      this.inverse.multiply(this.world[i]).decompose(node.position, node.quaternion, node.scale);
    });
    this.frame.matrixAutoUpdate = false; this.frame.matrix.copy(instance); this.frame.updateMatrixWorld(true);
  }
  private store(pose: Float32Array, instance: Matrix4): void {
    this.inverse.copy(instance).invert();
    this.nodes.forEach((node, i) => this.world[i].multiplyMatrices(this.inverse, node.matrixWorld).toArray(pose, i * 16));
  }
  /** Zombie moves and hunch as rotations/offsets in the hip parent's space (+x forward, +z lateral). */
  private layer(layers: CrowdLayers, phase: number): void {
    const { hip, torso, head } = this.rig;
    if (!hip || !torso) return;
    const parentScale = hip.parent!.getWorldScale(this.scale).y / this.frame.getWorldScale(this.scale).y || 1;
    const lean = layers.lean ?? 0, roll = layers.roll ?? 0, flinch = layers.flinch ?? 0, lunge = layers.lunge ?? 0, lurch = layers.lurch ?? 0;
    if (lean || roll) hip.quaternion.premultiply(this.rotation.setFromAxisAngle(Z, -lean)).premultiply(this.rotation.setFromAxisAngle(X, roll));
    if (lunge) { hip.position.x += lunge / parentScale; torso.quaternion.premultiply(this.rotation.setFromAxisAngle(Z, -Math.max(-.6, Math.min(.6, lunge * 1.6)))); }
    if (lurch) {
      // Lurch: the torso throws its weight over each landing foot and pitches on the push-off.
      const swing = Math.sin(phase * Math.PI * 2), push = Math.abs(Math.cos(phase * Math.PI * 2));
      torso.quaternion.premultiply(this.rotation.setFromAxisAngle(X, swing * .16 * lurch)).premultiply(this.rotation.setFromAxisAngle(Z, -(.1 + .1 * push) * lurch));
      head?.quaternion.premultiply(this.rotation.setFromAxisAngle(X, -swing * .1 * lurch));
    }
    if (flinch) {
      // Recoil away from the hit: chest and head snap back along the hit, hips give a little.
      const x = layers.hitX ?? -1, z = layers.hitZ ?? 0;
      torso.quaternion.premultiply(this.rotation.setFromAxisAngle(Z, -x * .42 * flinch)).premultiply(this.rotation.setFromAxisAngle(X, z * .32 * flinch));
      head?.quaternion.premultiply(this.rotation.setFromAxisAngle(Z, -x * .3 * flinch)).premultiply(this.rotation.setFromAxisAngle(X, z * .25 * flinch));
      hip.position.x += x * .04 * flinch / parentScale; hip.position.z += z * .04 * flinch / parentScale;
    }
    hip.updateMatrixWorld(true);
  }
  /** Legacy stance plants (mid band): world-space stance heels, no yaw lock or turn steps. */
  correct(id: number, pose: Float32Array, instance: Matrix4, phase: number, name: string, scale: number, speed: number, layers?: CrowdLayers): void {
    if (!layers && !this.animal && (!this.reach || !gaitShape[name])) return;
    let contacts = this.contacts.get(id);
    if (!contacts && !this.animal && gaitShape[name]) { this.toRest(); contacts = new GroundContacts(this.rig); this.contacts.set(id, contacts); }
    this.load(pose, instance);
    if (layers) this.layer(layers, phase);
    const stride = cadenceStride(name, scale, speed), run = /run|sprint|flee/.test(name) ? 1 : 0;
    if (this.animal) {
      let paws = this.paws.get(id);
      if (!paws) { paws = new PawContacts(this.frame, this.model); this.paws.set(id, paws); }
      paws.update(phase, stride, 'corgi-trot');
    } else if (contacts && strides[name] && speed > .06) contacts.update(phase, stride, run, 1, this.stance(name, stride, this.frame.getWorldScale(this.scale).y));
    this.store(pose, instance);
  }
  reset(id: number): void { this.contacts.get(id)?.reset(); this.paws.get(id)?.reset(); }
  /**
   * Displayed atlas row for one figure. Near the camera (`near`, within the footwork budget) the courier's
   * footwork runs: world-locked feet with yaw, step turns, knee-profile swings, pelvis over the support leg.
   * Further out moving figures keep the stance plants; standing far figures show the baked clip.
   */
  present(id: number, poses: CrowdPosePalette, frame: number, blend: [number, number], clip: string, phase: number, instance: Matrix4, scale: number, speed: number, time: number, near: boolean, layers?: CrowdLayers, style?: GaitStyle): number {
    const grounded = !this.animal && !!this.reach && (!!gaitStyles[clip] || standingClips.has(clip));
    let state = this.footwork.states.get(id);
    if (state && (time < state.time || time - state.time > .3)) { this.footwork.states.delete(id); state = undefined; }
    const want = near && grounded && this.footwork.admit(id);
    if (want || state) {
      if (!state) { this.toRest(); state = { contacts: new CourierGroundContacts(this.rig, this.rig.hip.parent!), owner: this, time, weight: 0, active: 0, run: gaitStyles[clip]?.run ?? 0, stance: gaitStyles[clip]?.stance ?? .55 }; this.footwork.states.set(id, state); }
      if (state.owner !== this) { state.contacts.rebind(this.rig, this.rig.hip.parent!); state.owner = this; }
      const dt = Math.min(.1, time - state.time); state.time = time;
      state.weight = Math.max(0, Math.min(1, state.weight + (want ? 1 : -1) * Math.max(dt, 1e-3) / .12));
      if (state.weight > 0) {
        this.footwork.mark(state);
        const footwork = state, gait = gaitStyles[clip], moving = !!gait && speed > .06;
        // Walk/run clip switches blend the gait shape (stance, knee flex) over ~0.15 s instead of jumping.
        if (gait) { const k = 1 - Math.exp(-dt / .15); state.run += (gait.run - state.run) * k; state.stance += (gait.stance - state.stance) * k; }
        const row = poses.correct(id, frame, blend[0], blend[1], pose => {
          this.load(pose, instance);
          if (layers) this.layer(layers, phase);
          const stride = moving ? cadenceStride(clip, scale, speed) : 0;
          footwork.contacts.update(moving ? phase : 0, stride, footwork.run, footwork.weight, moving ? speed : 0, dt, { stance: footwork.stance, knee: gait?.knee, maxSwing: .4, ...style });
          this.store(pose, instance);
        });
        // Never draw a broken solve: a non-finite pose collapses the figure to nothing on the GPU. Drop the
        // contacts (they restart fresh) and show the baked clip pose this frame.
        if (!poses.finite(row)) { this.footwork.states.delete(id); const baked = poses.correct(id, frame, blend[0], blend[1], () => {}); blend[1] = 1; return baked; }
        blend[1] = 1; return row;
      }
      this.footwork.states.delete(id);
    }
    if ((strides[clip] && speed > .06) || layers) {
      const row = poses.correct(id, frame, blend[0], blend[1], pose => this.correct(id, pose, instance, phase, clip, scale, speed, layers));
      blend[1] = 1; return row;
    }
    this.reset(id);
    if (blend[1] < 1) { const row = poses.correct(id, frame, blend[0], blend[1], () => {}); blend[1] = 1; return row; }
    return frame;
  }
}
