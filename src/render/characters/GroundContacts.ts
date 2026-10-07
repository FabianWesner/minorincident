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
    }));
  }
  reset(): void { for (const foot of this.feet) foot.phase = -1; }
  /** Mixer bindings skip unchanged values. Undo our last offset before it runs. */
  restore(): void { this.rig.hip.position.y += this.lowering; this.lowering = 0; }
  update(phase: number, stride: number, run: number, weight: number, support?: number): void {
    const rig = this.rig;
    rig.root.updateWorldMatrix(true, true);
    rig.root.getWorldPosition(this.origin); rig.root.getWorldQuaternion(this.frame); rig.root.getWorldScale(this.scale);
    this.forward.set(1, 0, 0).applyQuaternion(this.frame); this.forward.y = 0; this.forward.normalize();
    const stance = support ?? .55 - .31 * run, lift = (.06 + .055 * run) * this.scale.y;
    for (const [index, foot] of this.feet.entries()) {
      const p = (phase + index * .5) % 1;
      this.lateral.set(0, 0, foot.z * this.scale.y).applyQuaternion(this.frame);
      if (foot.phase < 0 || p < foot.phase) {
        foot.planted.copy(this.origin).add(this.lateral).addScaledVector(this.forward, stride * (stance / 2 - p));
        foot.planted.y = this.origin.y + this.sole * this.scale.y;
      }
      if (p <= stance) foot.target.copy(foot.planted);
      else {
        if (foot.phase <= stance) foot.start.copy(foot.planted);
        const u = (p - stance) / (1 - stance), ease = u * u * (3 - 2 * u);
        // Predicted next heel strike: where the actor will be at the end of swing.
        foot.target.copy(this.origin).add(this.lateral).addScaledVector(this.forward, stride * (1 - p + stance / 2));
        foot.target.y = this.origin.y + this.sole * this.scale.y;
        foot.target.lerp(foot.start, 1 - ease); foot.target.y += Math.sin(Math.PI * u) ** 2 * lift;
      }
      foot.phase = p;
    }
    // Bend support knees enough to reach long, low-cadence strides. Restore comes
    // from the mixer each frame, so this correction cannot accumulate.
    let lowering = 0;
    for (const foot of this.feet) {
      foot.ik.upper.getWorldPosition(this.joint);
      const dx = foot.target.x - this.joint.x, dz = foot.target.z - this.joint.z, reach = foot.reach * this.scale.y;
      const height = Math.sqrt(Math.max(.01, reach * reach - dx * dx - dz * dz));
      lowering = Math.max(lowering, this.joint.y - foot.target.y - height);
    }
    this.lowering = Math.min(.15, lowering / this.scale.y) * weight;
    rig.hip.position.y -= this.lowering;
    rig.hip.updateWorldMatrix(true, true);
    this.pole.copy(this.forward);
    for (const foot of this.feet) foot.ik.solve(foot.target, this.pole, this.frame, weight);
  }
}
