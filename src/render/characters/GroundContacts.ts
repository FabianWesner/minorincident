import { Quaternion, Vector3 } from 'three';
import type { CharacterRig } from './rig';
import { LimbIK } from './LimbIK';

/** Fitted courier contacts. The pelvis follows leg extension rather than a baked
 * crouch; fast turns release world plants and stops settle onto a narrow stance. */
export class GroundContacts {
  private readonly feet;
  private readonly origin = new Vector3();
  private readonly forward = new Vector3();
  private readonly lateral = new Vector3();
  private readonly frame = new Quaternion();
  private readonly scale = new Vector3();
  private readonly joint = new Vector3();
  private readonly delta = new Vector3();
  private readonly offset = new Vector3();
  private readonly sole: number;
  private heightOffset = 0;
  private heading: number | undefined;
  private turnBlend = 1;
  private stopTime = 0;
  private previousSpeed = 0;
  constructor(private readonly rig: CharacterRig) {
    rig.root.updateWorldMatrix(true, true);
    rig.root.getWorldPosition(this.origin); rig.root.getWorldQuaternion(this.frame);
    const scale = rig.root.getWorldScale(this.scale).y;
    this.sole = (rig.footL.getWorldPosition(this.joint).y - this.origin.y) / scale;
    this.feet = (['L', 'R'] as const).map(side => {
      const upper = rig[`leg${side}`], middle = rig[`shin${side}`], end = rig[`foot${side}`];
      const rest = upper.getWorldPosition(new Vector3()).sub(this.origin).applyQuaternion(this.frame.clone().invert()).divideScalar(scale);
      const a = middle.position.length(), b = end.position.length();
      return { ik: new LimbIK(upper, middle, end), a, b, rest, target: new Vector3(), planted: new Vector3(), stop: new Vector3(), phase: -1, plantHeading: 0 };
    });
  }
  reset(): void { for (const foot of this.feet) foot.phase = -1; this.heading = undefined; this.previousSpeed = 0; }
  /** Mixer bindings skip unchanged translations, so restore the last contact correction. */
  restore(): void { this.rig.hip.position.y -= this.heightOffset; this.heightOffset = 0; }
  update(phase: number, stride: number, run: number, weight: number, speed: number, dt: number): void {
    const rig = this.rig;
    rig.root.updateWorldMatrix(true, true);
    rig.root.getWorldPosition(this.origin); rig.root.getWorldQuaternion(this.frame); rig.root.getWorldScale(this.scale);
    this.forward.set(1, 0, 0).applyQuaternion(this.frame); this.forward.y = 0; this.forward.normalize();
    const heading = Math.atan2(-this.forward.z, this.forward.x);
    const angle = (from: number) => Math.atan2(Math.sin(heading - from), Math.cos(heading - from));
    const yaw = this.heading === undefined ? 0 : angle(this.heading); this.heading = heading;
    const turning = Math.abs(yaw) > Math.PI / 4 || Math.abs(yaw) / Math.max(dt, 1e-4) > 2.5;
    this.turnBlend = turning ? 0 : Math.min(1, this.turnBlend + dt / .12);
    const moving = speed > .08, stopped = !moving && this.previousSpeed > .08;
    if (stopped) { this.stopTime = 0; for (const foot of this.feet) foot.stop.copy(foot.target); }
    this.previousSpeed = speed; this.stopTime += dt;
    const stance = .5 - .25 * run, lift = (.008 + .02 * run) * this.scale.y;
    for (const [index, foot] of this.feet.entries()) {
      const p = (phase + index * .5) % 1;
      this.lateral.set(foot.rest.x, 0, foot.rest.z).multiplyScalar(this.scale.y).applyQuaternion(this.frame);
      const neutral = this.delta.copy(this.origin).add(this.lateral); neutral.y = this.origin.y + this.sole * this.scale.y;
      if (!moving) {
        foot.target.copy(neutral);
        if (this.stopTime < .12) foot.target.lerp(foot.stop, 1 - this.stopTime / .12);
        foot.phase = -1;
      } else {
        if (turning || Math.abs(angle(foot.plantHeading)) > Math.PI / 4) foot.phase = -1;
        if (foot.phase < 0 || p < foot.phase) {
          foot.planted.copy(neutral).addScaledVector(this.forward, stride * (stance / 2 - p) * this.turnBlend);
          foot.plantHeading = heading;
        }
        if (p <= stance && !turning) foot.target.copy(foot.planted);
        else {
          const u = Math.max(0, (p - stance) / (1 - stance)), ease = u * u * (3 - 2 * u);
          // In actor space: heel-to-toe travel matches the stride; no prediction overshoot.
          const x = stride * stance * (ease - .5);
          foot.target.copy(neutral).addScaledVector(this.forward, x * this.turnBlend);
          foot.target.y += Math.sin(Math.PI * u) ** 2 * lift;
        }
        if (turning) {
          // Small alternating lift while turning; feet stay directly under the body.
          foot.target.lerp(neutral, 1 - this.turnBlend);
          foot.target.y += Math.abs(Math.sin((phase + index * .5) * Math.PI * 2)) * .008 * this.scale.y;
        }
        foot.phase = p;
      }
      // Release a stale plant before it can create a lunge, including a teleported root.
      const maximum = (foot.a + foot.b) * this.scale.y * .55;
      const along = this.offset.copy(foot.target).sub(neutral).dot(this.forward);
      if (Math.abs(along) > maximum) {
        foot.target.addScaledVector(this.forward, Math.sign(along) * maximum - along);
        foot.planted.copy(foot.target); foot.phase = -1;
      }
    }
    // Highest pelvis that keeps both legs reachable. Aim for a soft 10° support
    // knee; unlike the pilot, swing lift never lowers the whole cycle's pelvis.
    let height = Infinity;
    const support = moving && !turning && this.feet.some(foot => foot.phase <= stance);
    for (const foot of this.feet) {
      if (support && foot.phase > stance) continue;
      foot.ik.upper.getWorldPosition(this.joint);
      const dx = foot.target.x - this.joint.x, dz = foot.target.z - this.joint.z;
      const length = Math.sqrt(foot.a ** 2 + foot.b ** 2 + 2 * foot.a * foot.b * Math.cos(10 * Math.PI / 180)) * this.scale.y;
      const desired = foot.target.y + Math.sqrt(Math.max(.001, length * length - dx * dx - dz * dz));
      height = Math.min(height, desired - (this.joint.y - rig.hip.getWorldPosition(this.delta).y));
    }
    rig.hip.getWorldPosition(this.joint);
    const parentScale = rig.hip.parent!.getWorldScale(this.delta).y;
    this.heightOffset = (height - this.joint.y) / parentScale * weight;
    rig.hip.position.y += this.heightOffset; rig.hip.updateWorldMatrix(true, true);
    const maxKnee = (25 + 20 * run) * Math.PI / 180;
    for (const foot of this.feet) {
      foot.ik.upper.getWorldPosition(this.joint);
      const minimum = Math.sqrt(foot.a ** 2 + foot.b ** 2 + 2 * foot.a * foot.b * Math.cos(maxKnee)) * this.scale.y;
      this.delta.copy(foot.target).sub(this.joint);
      if ((!support || foot.phase > stance) && this.delta.length() < minimum) {
        // Keep the ankle above the ground: extend the swing along the travel axis
        // rather than driving the foot through the floor to satisfy the knee limit.
        const along = this.delta.dot(this.forward);
        const across = this.delta.x ** 2 + this.delta.z ** 2 - along * along;
        const desired = Math.sqrt(Math.max(0, minimum * minimum - this.delta.y ** 2 - across));
        foot.target.addScaledVector(this.forward, (along < 0 ? -desired : desired) - along);
      }
      foot.ik.solve(foot.target, this.forward, this.frame, weight);
    }
  }
}
