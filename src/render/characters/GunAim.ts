import { Euler, Group, Matrix4, Object3D, Quaternion, Vector3 } from 'three';
import { LimbIK } from './LimbIK';

/** Stock/tube clearance at the courier's dominant shoulder (world metres). */
export const gunHoldOffset = (assetId: string): number => assetId === 'wpn.rocket-launcher' ? .32 : assetId === 'wpn.machine-gun' ? .14 : assetId === 'wpn.assault-rifle' ? .1 : assetId === 'wpn.pistol' ? 0 : .06;
/** Fitted to the chibi arm span: fore-end contact relative to the trigger grip,
 * +X barrel, +Y up. Crowd code-art weapons use their own +Z contact below. */
export interface LongGunHold { scale: number; support: [number, number, number]; stance: number; reach: number; drop: number; lateral: number; protract?: number }
export const longGunHolds: Record<string, LongGunHold> = {
  'wpn.assault-rifle': { scale: .65, support: [.30, .085, -.04], stance: .3, protract: 1.2, reach: .55, drop: .06, lateral: .05 },
  'wpn.hunting-rifle': { scale: .65, support: [.34, .015, -.04], stance: .3, protract: 1.2, reach: .55, drop: 0, lateral: .05 },
  'wpn.shotgun': { scale: .65, support: [.38, .05, -.04], stance: .3, protract: 1.2, reach: .45, drop: .03, lateral: .05 },
  'wpn.machine-gun': { scale: .55, support: [.485, .09, -.04], stance: .3, protract: 1.2, reach: .45, drop: 0, lateral: .05 },
  'wpn.rocket-launcher': { scale: .80, support: [.31, -.02, -.045], stance: .8, protract: 1.2, reach: .5, drop: .05, lateral: .18 },
  'wpn.smg': { scale: .65, support: [.34, .13, -.04], stance: .4, protract: 1.2, reach: .65, drop: .09, lateral: .05 },
};
/** The gunner on the L10 mounted minigun: right hand on the right spade grip, the support hand on the left one (axes of the support offset
 * are the right-hand socket's), body square to the aim. Tuned in the Scene Lab close-ups of `l10-minigun-gunner`. */
export const mountedGunHold: LongGunHold = { scale: 1, support: [0, 0, -.34], stance: 0, reach: .5, drop: .12, lateral: .17 };
export const crowdLongGunHold: LongGunHold = { scale: 1, support: [0, -.075, .30], stance: Math.PI / 2, reach: .6, drop: .08, lateral: .24 };
/** Two-handed low ready keeps the barrel forward, clear of the road. */
export const gunCarryElevation = (assetId: string): number => longGunHolds[assetId] ? -.18 : -.75;

/** Last upper-body layer: firing/carry grips independent of the animated gait.
 * +X is the asset barrel direction; crowd props use +Z instead. */
export class GunAim {
  private readonly arm: LimbIK;
  private readonly shoulderFrames: Object3D[] = [];
  private readonly supportArm?: LimbIK;
  private readonly supportTarget = new Vector3();
  private readonly contact = new Vector3();
  private readonly actualContact = new Vector3();
  private supportGap = 0;
  private readonly palmOffset = new Vector3();
  private readonly supportRotation = new Quaternion();
  private readonly roll = new Quaternion();
  private readonly gaze = new Quaternion();
  private readonly up = new Vector3(0, 1, 0);
  private readonly target = new Vector3();
  private readonly direction = new Vector3();
  private readonly scale = new Vector3();
  private readonly rotation = new Quaternion();
  private readonly barrelFrame = new Quaternion();
  private readonly gunAngles = new Euler(0, 0, 0, 'YXZ');
  private readonly barrel = new Vector3(1, 0, 0);
  private readonly torsoRotation = new Quaternion();
  private readonly parentRotation = new Quaternion();
  private readonly torsoAngles = new Euler(0,0,0,'YXZ');
  private readonly pole = new Vector3(0, -1, 0);
  constructor(private readonly upper: Object3D, middle: Object3D, end: Object3D, private readonly torso?: Object3D, support?: [Object3D, Object3D, Object3D], private readonly sockets?: [Object3D, Object3D], private readonly head?: Object3D) {
    this.arm = new LimbIK(upper, middle, end);
    if (support) {
      this.supportArm = new LimbIK(...support);
      // The skin rig has spine/chest/clavicle joints between torso and arms.
      // Its gait swing must not pull either shoulder away from a rigid grip.
      for (const arm of [upper, support[0]]) for (let node = arm.parent; node && node !== torso; node = node.parent) {
        if (!this.shoulderFrames.includes(node)) this.shoulderFrames.push(node);
      }
    }
  }
  apply(direction: { x: number; z: number }, barrelAxis = this.barrel, elevation = 0, reach = .995, turnTorso = true, lateral = 0, hold?: LongGunHold): void {
    if (hold) for (const node of this.shoulderFrames) node.quaternion.identity();
    if ((turnTorso || hold) && this.torso?.parent) {
      this.torso.updateWorldMatrix(true,true);
      this.torsoAngles.setFromQuaternion(this.torso.getWorldQuaternion(this.torsoRotation),'YXZ');
      // A bladed stance brings the support shoulder forward without stretching either arm.
      this.torsoAngles.y = -Math.atan2(direction.z,direction.x) - (hold?.stance ?? 0);
      if (hold) { this.torsoAngles.x = 0; this.torsoAngles.z = 0; }
      this.torsoRotation.setFromEuler(this.torsoAngles);
      this.torso.parent.getWorldQuaternion(this.parentRotation).invert().multiply(this.torsoRotation);
      this.torso.quaternion.copy(this.parentRotation); this.torso.updateWorldMatrix(false,true);
    }
    if (hold?.protract && this.supportArm) this.protract(direction, hold.protract);
    this.upper.updateWorldMatrix(true, true);
    this.direction.set(direction.x * Math.cos(elevation), Math.sin(elevation), direction.z * Math.cos(elevation)).normalize();
    const length = this.arm.middle.position.length() + this.arm.end.position.length();
    const scale = this.upper.getWorldScale(this.scale).y;
    // 99.5% reach leaves a small natural elbow bend (< 10 degrees), below the shoulder.
    this.upper.getWorldPosition(this.target).addScaledVector(this.direction, length * scale * (hold ? hold.reach - (.995 - reach) : reach));
    const offset = hold?.lateral ?? lateral;
    this.target.x -= direction.z * offset; this.target.z += direction.x * offset;
    if (hold) this.target.y -= hold.drop;
    // A forward vector alone leaves roll undefined near the reverse heading.
    // Build pitch/yaw with a stable up axis, then map the prop's barrel axis.
    if (hold) {
      this.gunAngles.set(0, -Math.atan2(direction.z, direction.x), elevation);
      this.rotation.setFromEuler(this.gunAngles).multiply(this.barrelFrame.setFromUnitVectors(barrelAxis, this.barrel));
    } else this.rotation.setFromUnitVectors(barrelAxis, this.direction);
    this.arm.solve(this.target, this.pole, this.rotation);
    if (hold && this.supportArm && this.sockets) {
      const [trigger, support] = this.sockets;
      trigger.updateWorldMatrix(true, false);
      this.supportTarget.fromArray(hold.support).multiplyScalar(hold.scale).applyMatrix4(trigger.matrixWorld);
      this.contact.copy(this.supportTarget);
      this.supportRotation.copy(this.rotation).multiply(this.roll.setFromAxisAngle(barrelAxis, -Math.PI / 2));
      // Contact is the palm socket, rather than the wrist joint. Keep the palm
      // below the fore-end and the fingers outside its solid surface.
      this.palmOffset.copy(support.position).multiply(this.supportArm.end.getWorldScale(this.scale)).applyQuaternion(this.supportRotation);
      this.supportTarget.sub(this.palmOffset);
      this.supportArm.solve(this.supportTarget, this.pole, this.supportRotation);
      this.supportGap = support.getWorldPosition(this.actualContact).distanceTo(this.contact);
      if (this.head?.parent) {
        this.head.parent.getWorldQuaternion(this.parentRotation).invert();
        this.gaze.setFromAxisAngle(this.up, -Math.atan2(direction.z, direction.x));
        this.head.quaternion.copy(this.parentRotation).multiply(this.gaze);
      }
    }
  }
  /** Swing the support clavicle forward about the vertical: the support
   * shoulder reaches the fore-end while the chest stays near the aim. */
  private protract(direction: { x: number; z: number }, angle: number): void {
    const clavicle = this.supportArm!.upper.parent;
    if (!clavicle || !this.shoulderFrames.includes(clavicle) || !clavicle.parent) return;
    clavicle.updateWorldMatrix(true, true);
    const shoulder = this.supportArm!.upper.getWorldPosition(this.target).sub(clavicle.getWorldPosition(this.contact));
    const sign = Math.sign(shoulder.z * direction.x - shoulder.x * direction.z) || 1;
    clavicle.getWorldQuaternion(this.torsoRotation).premultiply(this.roll.setFromAxisAngle(this.up, sign * angle));
    clavicle.quaternion.copy(clavicle.parent.getWorldQuaternion(this.parentRotation).invert().multiply(this.torsoRotation));
    clavicle.updateWorldMatrix(false, true);
  }
  get contactGap(): number { return this.supportGap; }
}

/** CPU rig mirror for the crowd's mutable pose row. Every child keeps its local
 * transform; the corrected matrices drive both GPU geometry and held props. */
export class CrowdGunAim {
  private readonly root = new Group();
  private readonly nodes: Object3D[];
  private readonly parents: number[];
  private readonly active: number[] = [];
  private readonly upperBody: number[] = [];
  private readonly parentInverses = new Map<number, Matrix4>();
  private readonly matrix = new Matrix4();
  private readonly parent = new Matrix4();
  private readonly aim: GunAim;
  private readonly armIK: LimbIK;
  private readonly shoulder = new Vector3();
  private readonly goal = new Vector3();
  private readonly frameQ = new Quaternion();
  private readonly forward = new Vector3(1, 0, 0);
  private readonly barrel = new Vector3(0, 0, 1);
  constructor(model: Object3D, private readonly parts: string[]) {
    this.nodes = parts.map(name => { const node = new Object3D(); node.name = name; node.quaternion._onChange(() => {}); return node; });
    this.parents = parts.map(name => {
      let parent = model.getObjectByName(name)?.parent;
      while (parent && !parts.includes(parent.name)) parent = parent.parent;
      return parent ? parts.indexOf(parent.name) : -1;
    });
    const torso = parts.indexOf('torso');
    for (let i = 0; i < parts.length; i++) {
      let ancestor = i;
      while (ancestor >= 0 && ancestor !== torso) ancestor = this.parents[ancestor];
      let parent = torso;
      while (parent >= 0 && parent !== i) parent = this.parents[parent];
      if (ancestor === torso) this.upperBody.push(i);
      if (ancestor === torso || parent === i) {
        this.active.push(i);
        if (this.parents[i] >= 0) this.parentInverses.set(this.parents[i], new Matrix4());
      } else { this.nodes[i].matrixAutoUpdate = false; this.nodes[i].matrixWorldAutoUpdate = false; }
    }
    model.updateWorldMatrix(true, true);
    this.nodes.forEach((node, i) => {
      (this.nodes[this.parents[i]] ?? this.root).add(node);
      const source = model.getObjectByName(parts[i])!;
      this.matrix.copy(source.matrixWorld);
      if (this.parents[i] >= 0) this.matrix.premultiply(this.parent.copy(model.getObjectByName(parts[this.parents[i]])!.matrixWorld).invert());
      this.matrix.decompose(node.position, node.quaternion, node.scale);
    });
    this.armIK = new LimbIK(this.nodes[parts.indexOf('armR')], this.nodes[parts.indexOf('foreArmR')], this.nodes[parts.indexOf('handR')]);
    this.aim = new GunAim(this.nodes[parts.indexOf('armR')], this.nodes[parts.indexOf('foreArmR')], this.nodes[parts.indexOf('handR')],this.nodes[parts.indexOf('torso')], ['armL', 'foreArmL', 'handL'].map(name => this.nodes[parts.indexOf(name)]) as [Object3D, Object3D, Object3D], [this.nodes[parts.indexOf('handR')], this.nodes[parts.indexOf('weaponSocketL')]], this.nodes[parts.indexOf('head')]);
  }
  /** Small hand props (cup, phone): the right elbow is bent, the hand rests at chest height in front of the body (`sip` 0) and a
   * cup-sized offset raises it to the mouth (`sip` 1). Offsets are in torso axes (+X forward, +Y up, +Z the figure's right) and
   * measured in arm lengths, so every body size gets the same pose. `socket` is the prop's offset from the hand (cup centre). */
  hold(pose: Float32Array, sip = 0, socket: [number, number, number] = [0, 0, 0]): void {
    this.load(pose);
    this.root.updateMatrixWorld(true);
    const torso = this.nodes[this.parts.indexOf('torso')], head = this.nodes[this.parts.indexOf('head')], upper = this.armIK.upper;
    const length = (this.armIK.middle.position.length() + this.armIK.end.position.length()) * upper.getWorldScale(this.goal).y;
    torso.getWorldQuaternion(this.frameQ);
    upper.getWorldPosition(this.shoulder);
    const chest = new Vector3(.55 * length, -.12 * length, -.14 * length - socket[2] * .6);
    const mouth = head.getWorldPosition(new Vector3()).add(new Vector3(.12, -.05, 0).applyQuaternion(this.frameQ)).sub(new Vector3(socket[0] + .04, socket[1] + .02, socket[2]).applyQuaternion(this.frameQ));
    this.goal.copy(chest).applyQuaternion(this.frameQ).add(this.shoulder).lerp(mouth, sip);
    // Short arms (the elderly) cannot reach the mouth straight: stop at a bent elbow.
    const reach = this.goal.distanceTo(this.shoulder); if (reach > .85 * length) this.goal.sub(this.shoulder).multiplyScalar(.85 * length / reach).add(this.shoulder);
    // Elbow low and slightly back, the way a held mug sits.
    this.armIK.solve(this.goal, new Vector3(-.3, -1, .2).applyQuaternion(this.frameQ), this.frameQ.clone());
    this.root.updateMatrixWorld(true);
    this.store(pose);
  }
  private load(pose: Float32Array): void {
    // Aiming only reads the torso branch and its ancestors; legs retain their
    // authoritative atlas matrices. Siblings share one inverse parent pose.
    for (const [parent, inverse] of this.parentInverses) inverse.fromArray(pose, parent * 16).invert();
    for (const i of this.active) {
      const node = this.nodes[i];
      this.matrix.fromArray(pose, i * 16);
      if (this.parents[i] >= 0) this.matrix.premultiply(this.parentInverses.get(this.parents[i])!);
      this.matrix.decompose(node.position, node.quaternion, node.scale);
    }
  }
  private store(pose: Float32Array): void {
    for (const i of this.upperBody) this.nodes[i].matrixWorld.toArray(pose, i * 16);
  }
  apply(pose: Float32Array, direction: { x: number; y?: number; z: number } = this.forward, elevation = Math.atan2(direction.y ?? 0, Math.hypot(direction.x, direction.z)), reach = .995, hold?: LongGunHold): void {
    this.load(pose);
    this.root.updateMatrixWorld(true);
    this.aim.apply(direction, this.barrel, elevation, reach, true, 0, hold);
    this.root.updateMatrixWorld(true);
    this.store(pose);
  }
}
