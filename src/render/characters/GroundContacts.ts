import { Quaternion, Vector3 } from 'three';
import type { CharacterRig } from './rig';
import { LimbIK } from './LimbIK';

/** World-space heel plants for the pilot. The actual travelled distance advances
 * phase; planted feet survive speed blends and the cadence cap without sliding. */
export class GroundContacts {
  private readonly feet;
  private readonly origin = new Vector3();
  private readonly forward = new Vector3();
  private readonly pole = new Vector3();
  private readonly lateral = new Vector3();
  private readonly frame = new Quaternion();
  private readonly scale = new Vector3();
  private readonly joint = new Vector3();
  private readonly sole: number;
  private lowering = 0;
  constructor(private readonly rig: CharacterRig) {
    rig.root.updateWorldMatrix(true, true);
    rig.root.getWorldPosition(this.origin);
    const scale = rig.root.getWorldScale(this.scale).y;
    this.sole = (rig.footL.getWorldPosition(this.joint).y - this.origin.y) / scale;
    this.feet = (['L', 'R'] as const).map(side => ({
      ik: new LimbIK(rig[`leg${side}`], rig[`shin${side}`], rig[`foot${side}`]),
      reach: (rig[`shin${side}`].position.length() + rig[`foot${side}`].position.length()) * .995,
      z: (rig[`foot${side}`].getWorldPosition(this.joint).z - this.origin.z) / scale,
      target: new Vector3(), planted: new Vector3(), start: new Vector3(), phase: -1,
      landing: new Vector3(), landed: false,
      rotation: new Quaternion(), release: -1,
    }));
  }
  reset(): void { for (const foot of this.feet) foot.phase = -1; }
  contact(index: number): { target: Vector3; yaw: number } | undefined {
    const foot = this.feet[index];
    if (foot.phase < 0) return undefined;
    this.forward.set(1, 0, 0).applyQuaternion(foot.rotation);
    return { target: foot.target, yaw: Math.atan2(-this.forward.z, this.forward.x) };
  }
  /** Keep the last world contacts when a figure leaves the near footwork band. */
  inherit(phase: number, contacts: { target: Vector3; yaw: number }[]): void {
    for (const [i, foot] of this.feet.entries()) {
      foot.phase = (phase + i * .5) % 1; foot.planted.copy(contacts[i].target); foot.target.copy(foot.planted); foot.start.copy(foot.planted);
      foot.rotation.setFromAxisAngle(new Vector3(0, 1, 0), contacts[i].yaw); foot.release = -1; foot.landed = false;
    }
  }
  /** Mixer bindings skip unchanged values. Undo our last offset before it runs. */
  restore(): void { this.rig.hip.position.y += this.lowering; this.lowering = 0; }
  update(phase: number, stride: number, run: number, weight: number, support?: number, worldReady = false): void {
    const rig = this.rig;
    if (!worldReady) rig.root.updateWorldMatrix(true, true);
    rig.root.matrixWorld.decompose(this.origin, this.frame, this.scale);
    this.forward.set(1, 0, 0).applyQuaternion(this.frame); this.forward.y = 0; this.forward.normalize();
    const stance = support ?? .55 - .31 * run, lift = (.06 + .055 * run) * this.scale.y;
    for (const [index, foot] of this.feet.entries()) {
      const p = (phase + index * .5) % 1;
      this.lateral.set(0, 0, foot.z * this.scale.y).applyQuaternion(this.frame);
      if (foot.phase < 0 || p < foot.phase) {
        // Admission and touchdown keep the drawn contact, rather than jumping to a theoretical stride plant.
        if (foot.phase < 0) foot.planted.setFromMatrixPosition(foot.ik.end.matrixWorld);
        else foot.planted.copy(foot.target);
        foot.planted.y = this.origin.y + this.sole * this.scale.y;
        foot.landed = false; foot.release = -1; foot.rotation.copy(this.frame);
      }
      // A reversal releases the old support in a lifted step instead of rotating a planted shoe with the body.
      if (p <= stance && foot.release < 0 && foot.rotation.angleTo(this.frame) > .5) foot.release = p;
      const support = foot.release < 0 ? stance : foot.release;
      if (p <= support) { foot.planted.y = this.origin.y + this.sole * this.scale.y; foot.target.copy(foot.planted); }
      else {
        if (foot.phase <= support) foot.start.copy(foot.planted);
        const u = (p - support) / (1 - support);
        // Move only while the sole clears the 1.2 cm contact band. The old low sin² arc dragged the shoe at both ends.
        const travel = Math.max(0, Math.min(1, (u - .18) / .64)), ease = travel * travel * (3 - 2 * travel);
        // Predicted next heel strike: where the actor will be at the end of swing.
        if (!foot.landed) foot.landing.copy(this.origin).add(this.lateral).addScaledVector(this.forward, stride * (1 - p + stance / 2));
        if (u >= .82) foot.landed = true;
        foot.target.copy(foot.landing);
        foot.target.y = this.origin.y + this.sole * this.scale.y;
        foot.target.lerp(foot.start, 1 - ease); foot.target.y += Math.sin(Math.PI * u) ** 2 * lift;
      }
      foot.phase = p;
    }
    // Bend support knees enough to reach long, low-cadence strides. Restore comes
    // from the mixer each frame, so this correction cannot accumulate.
    let lowering = 0;
    for (const foot of this.feet) {
      this.joint.setFromMatrixPosition(foot.ik.upper.matrixWorld);
      const dx = foot.target.x - this.joint.x, dz = foot.target.z - this.joint.z, reach = foot.reach * this.scale.y;
      const height = Math.sqrt(Math.max(.01, reach * reach - dx * dx - dz * dz));
      lowering = Math.max(lowering, this.joint.y - foot.target.y - height);
    }
    this.lowering = Math.min(.15, lowering / this.scale.y) * weight;
    // The caller refreshed the rig above. Only lowering changes its parent matrices.
    if (this.lowering > 0) { rig.hip.position.y -= this.lowering; rig.hip.updateMatrixWorld(true); }
    this.pole.copy(this.forward);
    for (const foot of this.feet) {
      const support = foot.release < 0 ? stance : foot.release;
      if (foot.phase > support) foot.rotation.slerp(this.frame, Math.min(1, (foot.phase - support) / (1 - support) / .5));
      foot.ik.solve(foot.target, this.pole, foot.rotation, weight, true);
    }
  }
}
