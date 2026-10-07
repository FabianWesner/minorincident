import { Quaternion, Vector3, type Object3D } from 'three';

/** Two-joint presentation correction. Targets and bend poles are world-space;
 * rest offsets supply lengths, so the same solver fits the loaded courier rig. */
export class LimbIK {
  private readonly target = new Vector3();
  private readonly axis = new Vector3();
  private readonly bend = new Vector3();
  private readonly joint = new Vector3();
  private readonly lower = new Vector3();
  private readonly frame = new Quaternion();
  private readonly upperRotation = new Quaternion();
  private readonly lowerRotation = new Quaternion();
  private readonly endRotation = new Quaternion();
  private readonly upperDirection: Vector3;
  private readonly lowerDirection: Vector3;
  private readonly a: number;
  private readonly b: number;
  constructor(readonly upper: Object3D, readonly middle: Object3D, readonly end: Object3D) {
    this.a = middle.position.length(); this.b = end.position.length();
    this.upperDirection = middle.position.clone().normalize(); this.lowerDirection = end.position.clone().normalize();
  }
  solve(target: Vector3, pole: Vector3, orientation: Quaternion, weight = 1): void {
    const parent = this.upper.parent!;
    parent.updateWorldMatrix(true, false);
    parent.worldToLocal(this.target.copy(target)).sub(this.upper.position);
    parent.getWorldQuaternion(this.frame).invert();
    const distance = Math.max(.0001, Math.min(this.a + this.b - .0001, this.target.length()));
    this.axis.copy(this.target).normalize();
    this.bend.copy(pole).applyQuaternion(this.frame).addScaledVector(this.axis, -this.bend.dot(this.axis)).normalize();
    const along = (this.a * this.a + distance * distance - this.b * this.b) / (2 * distance);
    this.joint.copy(this.axis).multiplyScalar(along).addScaledVector(this.bend, Math.sqrt(Math.max(0, this.a * this.a - along * along)));
    this.upperRotation.setFromUnitVectors(this.upperDirection, this.joint.normalize());
    this.lower.copy(this.axis).multiplyScalar(distance).addScaledVector(this.joint, -this.a).applyQuaternion(this.endRotation.copy(this.upperRotation).invert()).normalize();
    this.lowerRotation.setFromUnitVectors(this.lowerDirection, this.lower);
    this.endRotation.copy(this.upperRotation).multiply(this.lowerRotation).invert().multiply(this.frame).multiply(orientation);
    this.upper.quaternion.slerp(this.upperRotation, weight);
    this.middle.quaternion.slerp(this.lowerRotation, weight);
    this.end.quaternion.slerp(this.endRotation, weight);
    this.upper.updateWorldMatrix(false, true);
  }
}
