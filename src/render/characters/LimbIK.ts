import { Matrix4, Quaternion, Vector3, type Object3D } from 'three';

/** Two-joint presentation correction. Targets and bend poles are world-space;
 * loaded joint offsets supply lengths, including retargeted translation tracks. */
export class LimbIK {
  private readonly target = new Vector3();
  private readonly inverseParent = new Matrix4();
  private readonly axis = new Vector3();
  private readonly bend = new Vector3();
  private readonly joint = new Vector3();
  private readonly lower = new Vector3();
  private readonly frame = new Quaternion();
  private readonly upperRotation = new Quaternion();
  private readonly lowerRotation = new Quaternion();
  private readonly endRotation = new Quaternion();
  private readonly upperDirection = new Vector3();
  private readonly lowerDirection = new Vector3();
  constructor(readonly upper: Object3D, readonly middle: Object3D, readonly end: Object3D) {}
  solve(target: Vector3, pole: Vector3, orientation: Quaternion, weight = 1, worldReady = false): void {
    // Retargeted clips may animate joint translations as well as rotations.
    // Solve against the loaded offsets, rather than rotating cached bind directions.
    const a = this.middle.position.length(), b = this.end.position.length();
    this.upperDirection.copy(this.middle.position).normalize();
    this.lowerDirection.copy(this.end.position).normalize();
    const parent = this.upper.parent!;
    if (!worldReady) parent.updateWorldMatrix(true, false);
    this.target.copy(target).applyMatrix4(this.inverseParent.copy(parent.matrixWorld).invert()).sub(this.upper.position);
    parent.matrixWorld.decompose(this.joint, this.frame, this.axis); this.frame.invert();
    const distance = Math.max(.0001, Math.min(a + b - .0001, this.target.length()));
    this.axis.copy(this.target).normalize();
    this.bend.copy(pole).applyQuaternion(this.frame).addScaledVector(this.axis, -this.bend.dot(this.axis)).normalize();
    const along = (a * a + distance * distance - b * b) / (2 * distance);
    this.joint.copy(this.axis).multiplyScalar(along).addScaledVector(this.bend, Math.sqrt(Math.max(0, a * a - along * along)));
    this.upperRotation.setFromUnitVectors(this.upperDirection, this.joint.normalize());
    this.lower.copy(this.axis).multiplyScalar(distance).addScaledVector(this.joint, -a).applyQuaternion(this.endRotation.copy(this.upperRotation).invert()).normalize();
    this.lowerRotation.setFromUnitVectors(this.lowerDirection, this.lower);
    this.endRotation.copy(this.upperRotation).multiply(this.lowerRotation).invert().multiply(this.frame).multiply(orientation);
    this.upper.quaternion.slerp(this.upperRotation, weight);
    this.middle.quaternion.slerp(this.lowerRotation, weight);
    this.end.quaternion.slerp(this.endRotation, weight);
    this.upper.updateWorldMatrix(false, true);
  }
}
