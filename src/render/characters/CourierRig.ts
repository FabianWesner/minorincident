import { Quaternion, Vector3, type Object3D } from 'three';
import type { CharacterRig } from './rig';

/** Courier skeleton v2 (assets/char.courier-female-skin/build.py). The runtime joint contract is unchanged;
 * v2 inserts the Mesh2Motion chain (torso = spine_01, spine = spine_02, chest = spine_03, neck = neck_01,
 * clavicle* = clavicle_*), adds deformation helpers driven here (elbow*, knee*: half the joint angle;
 * foreArmTwist*: half the hand roll; toe*: ball of the shoe) and face/hair bones (eye*, iris*, pony1..3). */
const chainNames = ['spine', 'chest', 'neck', 'clavicleL', 'clavicleR'] as const;
const helperNames = ['elbowL', 'elbowR', 'kneeL', 'kneeR', 'foreArmTwistL', 'foreArmTwistR', 'toeL', 'toeR', 'eyeL', 'eyeR', 'irisL', 'irisR'] as const;
type ChainName = typeof chainNames[number];
type HelperName = typeof helperNames[number];
export type CourierBones = Record<ChainName | HelperName, Object3D> & { pony: Object3D[] };

/** v2 bones of a loaded courier, or undefined for the rigid figure, crowds and older skins. */
export function courierBones(root: Object3D): CourierBones | undefined {
  const bones = { pony: [] as Object3D[] } as unknown as CourierBones;
  for (const name of [...chainNames, ...helperNames]) { const node = root.getObjectByName(name); if (!node) return undefined; bones[name] = node; }
  for (let i = 1; i <= 3; i++) { const node = root.getObjectByName(`pony${i}`); if (node) bones.pony.push(node); }
  return bones;
}
/** Mixer-driven chain nodes (restored with the named joints before each sample). */
export const chainNodes = (bones: CourierBones): Object3D[] => chainNames.map(name => bones[name]);

const a = new Vector3(), b = new Vector3();
/** Torso-frame vector from the torso (waist) pivot to the midpoint of the shoulders. `rotation(node)` supplies the
 * local rotation of spine, chest and clavicles (live nodes or sampled tracks); v1 rigs use the arm offsets directly. */
export function shoulderOffset(rig: CharacterRig, bones: CourierBones | undefined, out: Vector3, rotation = (node: Object3D) => node.quaternion): Vector3 {
  if (!bones) return out.copy(rig.armL.position).add(rig.armR.position).multiplyScalar(.5);
  a.copy(rig.armL.position).applyQuaternion(rotation(bones.clavicleL)).add(bones.clavicleL.position);
  b.copy(rig.armR.position).applyQuaternion(rotation(bones.clavicleR)).add(bones.clavicleR.position);
  return out.copy(a).add(b).multiplyScalar(.5).applyQuaternion(rotation(bones.chest)).add(bones.chest.position)
    .applyQuaternion(rotation(bones.spine)).add(bones.spine.position);
}

const twist = new Quaternion(), axis = new Vector3(), identity = new Quaternion(), q = new Quaternion();
const BULGE = .12;
/** Stateless helper drive, applied after every pose layer (any frame, any number of times). */
export function driveHelpers(rig: CharacterRig, bones: CourierBones): void {
  for (const side of ['L', 'R'] as const) {
    const hand = rig[`hand${side}`];
    // Swing-twist: the twist bone takes half of the hand's roll about the forearm axis (wrist candy-wrapping).
    axis.copy(hand.position).normalize();
    const d = hand.quaternion.x * axis.x + hand.quaternion.y * axis.y + hand.quaternion.z * axis.z;
    twist.set(axis.x * d, axis.y * d, axis.z * d, hand.quaternion.w);
    if (twist.lengthSq() < 1e-12) twist.identity(); else twist.normalize();
    bones[`foreArmTwist${side}`].quaternion.copy(identity).slerp(twist, .5);
    for (const [helper, joint] of [[bones[`elbow${side}`], rig[`foreArm${side}`]], [bones[`knee${side}`], rig[`shin${side}`]]] as const) {
      helper.quaternion.copy(identity).slerp(joint.quaternion, .5);
      // Joint bulge: widen the cross-section at the crease as it bends (LBS loses volume on the inner side).
      const bulge = 1 + BULGE * (1 - Math.abs(joint.quaternion.w));
      helper.scale.set(bulge, 1, bulge);
    }
  }
}

/** Deterministic hash in [0, 1) (blink intervals). */
const hash = (n: number): number => { let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; };
const DEG = Math.PI / 180;
export interface PresentInput {
  /** Presentation clock (s), the animator's sim-tick time: unchanged time = frozen frame. */
  time: number;
  /** Animator evaluation count; unchanged = the animator did not re-sample this frame. */
  evaluation: number;
  /** World look target, or null. */
  look: Vector3 | null;
  /** 0..1 look permission (0 in strikes, riding, hurt and death). */
  lookWeight: number;
  /** Starts a blink when it changes (hurt reactions). */
  hurtTick: number;
  /** Floor height (world) for the toe roll; undefined while riding. */
  ground?: number;
}
interface Particle { p: Vector3; prev: Vector3; length: number }
/** Living layer for the fitted courier: ponytail chain and bag pendulum (secondary motion), look-at spread over
 * chest/neck/head with eyes, blink, plus the stateless helpers. Steps only on the presentation clock with a fixed
 * 1/120 s substep; a frozen or repeated frame restores the captured base pose and re-applies the same state, so
 * paused frames are bit-identical. Runs after ride contacts, as the last pose layer of the frame. */
export class CourierLiving {
  private readonly base = new Map<Object3D, Quaternion>();
  private readonly lookNodes: [Object3D, number, number][];
  private lastTime = Number.NaN;
  private lastEvaluation = -1;
  private accumulator = 0;
  private yaw = 0;
  private pitch = 0;
  private weight = 0;
  private blinkAt = 0;
  private blinkCount = 0;
  private hurtTick = -1;
  private blink = 0;
  private readonly pony: Particle[] = [];
  private ponyReady = false;
  private readonly tip = new Vector3();
  private bagPitch = 0;
  private bagRoll = 0;
  private bagPitchVelocity = 0;
  private bagRollVelocity = 0;
  private readonly bagAnchor = new Vector3();
  private readonly bagVelocity = new Vector3();
  private readonly bagAccel = new Vector3();
  private bagReady = false;
  private readonly bagRest: Quaternion;
  private readonly scratch = new Vector3();
  private readonly scratch2 = new Vector3();
  private readonly up = new Vector3(0, 1, 0);
  private readonly frame = new Quaternion();
  private readonly rotation = new Quaternion();
  private readonly parentRotation = new Quaternion();
  private readonly irisRest: [Vector3, Vector3];
  /** Diagnostics for tests/evidence. */
  readonly stats = { yaw: 0, pitch: 0, weight: 0, blink: 0, bagPitch: 0, bagRoll: 0, tip: new Vector3() };
  constructor(private readonly rig: CharacterRig, readonly bones: CourierBones, private readonly seed = 1) {
    // Look-at spread (research §2 #4): chest 20 % / neck 30 % / head 50 % of yaw; pitch neck 40 % / head 60 %.
    this.lookNodes = [[bones.chest, .2, 0], [bones.neck, .3, .4], [rig.head, .5, .6]];
    for (const node of [bones.chest, bones.neck, rig.head, rig.backpackSocket]) this.base.set(node, new Quaternion());
    this.bagRest = rig.backpackSocket.quaternion.clone();
    this.irisRest = [bones.irisL.position.clone(), bones.irisR.position.clone()];
    for (const bone of bones.pony) this.pony.push({ p: new Vector3(), prev: new Vector3(), length: 0 });
    this.blinkAt = 1.5 + 3 * hash(seed);
  }
  present(input: PresentInput): void {
    const fresh = input.evaluation !== this.lastEvaluation;
    for (const [node, q] of this.base) if (fresh) q.copy(node.quaternion); else node.quaternion.copy(q);
    this.lastEvaluation = input.evaluation;
    let dt = Number.isNaN(this.lastTime) ? 0 : input.time - this.lastTime;
    if (dt < 0 || dt > .25) { dt = 0; this.ponyReady = this.bagReady = false; this.accumulator = 0; }
    this.lastTime = input.time;
    const rig = this.rig, bones = this.bones;
    driveHelpers(rig, bones);
    rig.root.updateMatrixWorld(true);
    if (dt > 0) this.stepLook(input, dt);
    this.applyLook(input.look);
    if (dt > 0) this.stepBlink(input);
    const closed = 1 - .9 * this.blink;
    bones.eyeL.scale.y = bones.eyeR.scale.y = closed;
    // Secondary motion steps at 1/120 s on the presentation clock; the root matrices are current here.
    rig.root.updateMatrixWorld(true);
    this.accumulator += dt;
    const h = 1 / 120;
    if (dt > 0) this.sampleBagAnchor(dt);
    let steps = 0;
    while (this.accumulator >= h - 1e-9 && steps < 30) { this.stepBag(h); this.stepPony(h); this.accumulator -= h; steps++; }
    if (!this.bagReady) this.sampleBagAnchor(0);
    if (!this.ponyReady) this.stepPony(0);
    this.applyBag(); this.applyPony();
    if (input.ground !== undefined) this.rollToes(input.ground);
    else bones.toeL.quaternion.identity(), bones.toeR.quaternion.identity();
    this.stats.yaw = this.yaw * this.weight; this.stats.pitch = this.pitch * this.weight; this.stats.weight = this.weight; this.stats.blink = this.blink;
    this.stats.bagPitch = this.bagPitch; this.stats.bagRoll = this.bagRoll;
    rig.root.updateMatrixWorld(true);
  }
  /** Yaw/pitch toward the target relative to the actor's facing, clamped ±70°/±25°, ≤ 360°/s. */
  private stepLook(input: PresentInput, dt: number): void {
    let yaw = 0, pitch = 0, want = 0;
    if (input.look && input.lookWeight > 0) {
      const head = this.rig.head.getWorldPosition(this.scratch), d = this.scratch2.copy(input.look).sub(head);
      this.rig.root.getWorldQuaternion(this.frame).invert(); d.applyQuaternion(this.frame);
      const flat = Math.hypot(d.x, d.z);
      yaw = Math.atan2(-d.z, d.x); pitch = Math.atan2(d.y, flat);
      // Behind the courier: no owl turn; the gaze fades out instead.
      want = input.lookWeight * (1 - Math.max(0, Math.min(1, (Math.abs(yaw) - 100 * DEG) / (30 * DEG))));
      yaw = Math.max(-70 * DEG, Math.min(70 * DEG, yaw)); pitch = Math.max(-25 * DEG, Math.min(25 * DEG, pitch));
    }
    if (want < 1e-3) { yaw = this.yaw; pitch = this.pitch; }
    const rate = 360 * DEG * dt, ease = 1 - Math.exp(-dt / .12);
    this.yaw += Math.max(-rate, Math.min(rate, (yaw - this.yaw) * ease));
    this.pitch += Math.max(-rate, Math.min(rate, (pitch - this.pitch) * ease));
    this.weight += (want - this.weight) * (1 - Math.exp(-dt / (want > this.weight ? .2 : .08)));
    if (this.weight < 1e-4 && want === 0) this.weight = 0;
  }
  private applyLook(look: Vector3 | null): void {
    const w = this.weight;
    if (w > 0) {
      const lateral = this.scratch.set(0, 0, 1).applyQuaternion(this.rig.root.getWorldQuaternion(this.frame));
      for (const [node, yawShare, pitchShare] of this.lookNodes) {
        const parent = node.parent!; parent.getWorldQuaternion(this.parentRotation);
        // World-space increment (yaw about world up, pitch about the actor's lateral axis), expressed locally.
        this.rotation.setFromAxisAngle(this.up, this.yaw * w * yawShare).multiply(q.setFromAxisAngle(lateral, this.pitch * w * pitchShare));
        node.quaternion.premultiply(q.copy(this.parentRotation).invert().multiply(this.rotation).multiply(this.parentRotation));
        node.updateMatrixWorld(true);
      }
    }
    // Eyes take the rest of the turn (≤ 4 mm iris shift at the clamp) and lead it while the head eases in.
    const eyeYaw = look ? Math.max(-1, Math.min(1, this.yaw / (70 * DEG))) * w : 0, eyePitch = look ? Math.max(-1, Math.min(1, this.pitch / (25 * DEG))) * w : 0;
    for (const [i, side] of (['L', 'R'] as const).entries()) this.bones[`iris${side}`].position.copy(this.irisRest[i]).add(this.scratch2.set(0, eyePitch * .003, -eyeYaw * .004));
  }
  /** Blinks every 2–6 s (seeded per actor), lids closed ~0.1 s; a hurt reaction blinks at once. */
  private stepBlink(input: PresentInput): void {
    if (input.hurtTick !== this.hurtTick) { if (this.hurtTick >= 0 && input.time < this.blinkAt) this.blinkAt = input.time; this.hurtTick = input.hurtTick; }
    const u = (input.time - this.blinkAt) / .15;
    this.blink = u < 0 || u > 1 ? 0 : u < .3 ? u / .3 : u < .65 ? 1 : 1 - (u - .65) / .35;
    if (u > 1) { this.blinkCount++; this.blinkAt = input.time + 2 + 4 * hash(this.seed * 7919 + this.blinkCount); }
  }
  /** Anchor (strap) acceleration in the bag's parent frame, once per presented frame. */
  private sampleBagAnchor(dt: number): void {
    const socket = this.rig.backpackSocket, anchor = socket.getWorldPosition(this.scratch);
    if (!this.bagReady || dt === 0) { this.bagAnchor.copy(anchor); this.bagVelocity.set(0, 0, 0); this.bagAccel.set(0, 0, 0); this.bagReady = true; return; }
    const velocity = this.scratch2.copy(anchor).sub(this.bagAnchor).divideScalar(dt);
    if (velocity.lengthSq() > 400) velocity.copy(this.bagVelocity); // teleport or seat snap
    this.bagAccel.copy(velocity).sub(this.bagVelocity).divideScalar(dt);
    this.bagVelocity.copy(velocity); this.bagAnchor.copy(anchor);
    socket.parent!.getWorldQuaternion(this.frame).invert(); this.bagAccel.applyQuaternion(this.frame).clampScalar(-30, 30);
  }
  /** 2-DOF bag pendulum about its strap anchor, driven by the anchor's acceleration; the hip side is a collider. */
  private stepBag(h: number): void {
    // Small-angle pendulum (L ≈ 0.22 m, ~1.1 Hz, ζ ≈ 0.3): forward acceleration swings the bag back (about +Z).
    const k = 9.81 / .22, c = 2 * .3 * Math.sqrt(k), accel = this.bagAccel;
    this.bagPitchVelocity += (-k * this.bagPitch - c * this.bagPitchVelocity - accel.x / .22) * h;
    this.bagRollVelocity += (-k * this.bagRoll - c * this.bagRollVelocity + accel.z / .22) * h;
    this.bagPitch += this.bagPitchVelocity * h; this.bagRoll += this.bagRollVelocity * h;
    // Collider: the bag hangs behind the hip; it may swing out 35° but only 3° in toward the body.
    if (this.bagPitch > 3 * DEG) { this.bagPitch = 3 * DEG; this.bagPitchVelocity = Math.min(0, this.bagPitchVelocity); }
    if (this.bagPitch < -35 * DEG) { this.bagPitch = -35 * DEG; this.bagPitchVelocity = Math.max(0, this.bagPitchVelocity); }
    if (Math.abs(this.bagRoll) > 20 * DEG) { this.bagRoll = Math.sign(this.bagRoll) * 20 * DEG; this.bagRollVelocity = 0; }
  }
  private applyBag(): void {
    const socket = this.rig.backpackSocket;
    socket.quaternion.premultiply(this.rotation.setFromAxisAngle(this.scratch.set(0, 0, 1), this.bagPitch).multiply(q.setFromAxisAngle(this.scratch2.set(1, 0, 0), this.bagRoll)));
    socket.updateMatrixWorld(true);
  }
  /** Verlet ponytail (Jakobsen): inertia, a pull toward the head-carried rest pose, gravity, fixed segment lengths
   * and sphere colliders for the head and the upper back. Particles are the tails of pony1..3. */
  private stepPony(h: number): void {
    const bones = this.bones.pony;
    if (!bones.length) return;
    const head = this.rig.head, chest = this.bones.chest, scale = head.getWorldScale(this.scratch).y;
    let parent = bones[0].getWorldPosition(this.tip);
    head.getWorldQuaternion(this.parentRotation);
    const rest = this.scratch2;
    for (let i = 0; i < bones.length; i++) {
      const particle = this.pony[i], offset = i + 1 < bones.length ? bones[i + 1].position : bones[i].position;
      // Rest tail: the chain straight along its bind direction, carried by the head.
      rest.copy(offset).applyQuaternion(this.parentRotation).multiplyScalar(scale).add(parent);
      if (!this.ponyReady || h === 0) { particle.p.copy(rest); particle.prev.copy(rest); particle.length = offset.length() * scale; parent = particle.p; continue; }
      const next = this.scratch.copy(particle.p).sub(particle.prev).multiplyScalar(.82).add(particle.p);
      next.addScaledVector(rest.sub(particle.p), .16 - .04 * i);
      next.y -= 3.5 * h * h;
      next.sub(parent).setLength(particle.length).add(parent);
      for (const [center, radius] of this.colliders(head, chest, scale)) {
        const d = next.distanceTo(center), r = radius + .012 * scale;
        if (d < r) { next.sub(center).setLength(r).add(center); next.sub(parent).setLength(particle.length).add(parent); }
      }
      particle.prev.copy(particle.p); particle.p.copy(next); parent = particle.p;
    }
    this.ponyReady = true;
    this.stats.tip.copy(this.pony[this.pony.length - 1].p);
  }
  private readonly sphereCenters = [new Vector3(), new Vector3()];
  private readonly sphereList: [Vector3, number][] = [[this.sphereCenters[0], 0], [this.sphereCenters[1], 0]];
  /** Head sphere (skull under the cap) and upper back sphere, world. */
  private colliders(head: Object3D, chest: Object3D, scale: number): [Vector3, number][] {
    head.localToWorld(this.sphereCenters[0].set(-.03, .17, 0)); this.sphereList[0][1] = .2 * scale;
    chest.localToWorld(this.sphereCenters[1].set(-.04, .02, 0)); this.sphereList[1][1] = .13 * scale;
    return this.sphereList;
  }
  private applyPony(): void {
    const bones = this.bones.pony;
    if (!bones.length || !this.ponyReady) return;
    for (let i = 0; i < bones.length; i++) {
      const bone = bones[i], offset = i + 1 < bones.length ? bones[i + 1].position : bones[i].position;
      bone.parent!.getWorldQuaternion(this.parentRotation);
      bone.quaternion.identity();
      const from = this.scratch.copy(offset).applyQuaternion(this.parentRotation).normalize();
      const to = this.scratch2.copy(this.pony[i].p).sub(bone.getWorldPosition(this.tip)).normalize();
      this.rotation.setFromUnitVectors(from, to);
      bone.quaternion.copy(this.parentRotation).invert().multiply(this.rotation).multiply(this.parentRotation);
      bone.updateMatrixWorld(true);
    }
  }
  /** Ball-of-foot roll: when the heel lifts, the toe stays on the floor (stateless, up to 45°). */
  private rollToes(ground: number): void {
    for (const side of ['L', 'R'] as const) {
      const toe = this.bones[`toe${side}`]; toe.quaternion.identity(); toe.updateMatrixWorld(true);
      const pivot = toe.getWorldPosition(this.scratch), tip = toe.localToWorld(this.scratch2.set(.09, -.03, 0));
      const length = tip.distanceTo(pivot), drop = ground - tip.y;
      if (drop <= 0 || pivot.y - ground > .06) continue;
      const now = Math.asin(Math.max(-1, Math.min(1, (tip.y - pivot.y) / length))), flat = Math.asin(Math.max(-1, Math.min(1, (ground - pivot.y) / length)));
      toe.quaternion.setFromAxisAngle(this.scratch.set(0, 0, 1), Math.min(45 * DEG, Math.max(0, flat - now)));
      toe.updateMatrixWorld(true);
    }
  }
}
