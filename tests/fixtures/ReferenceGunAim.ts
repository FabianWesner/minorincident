// Original solver at e54658fc3: numerical oracle for world-matrix reuse.
import { Euler, Object3D, Quaternion, Vector3 } from 'three';
import { LimbIK } from '../../src/render/characters/LimbIK';
import type { LongGunHold } from '../../src/render/characters/GunAim';

export class ReferenceGunAim {
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

