import { Quaternion, Vector3 } from 'three';
import type { CharacterRig } from './rig';
import { LimbIK } from './LimbIK';

/** Fitted courier contacts. The pelvis follows leg extension rather than a baked
 * crouch; fast turns release world plants and stops settle onto a narrow stance. */
export class CourierGroundContacts {
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
  private readonly hipRest: number;
  private heightOffset = 0;
  private pelvisHeight: number | undefined;
  private heading: number | undefined;
  private turnBlend = 1;
  private stopTime = 0;
  private moving = false;
  private startTime = 1;
  private readonly previousTarget = new Vector3();
  constructor(private readonly rig: CharacterRig) {
    rig.root.updateWorldMatrix(true, true);
    rig.root.getWorldPosition(this.origin); rig.root.getWorldQuaternion(this.frame);
    const scale = rig.root.getWorldScale(this.scale).y;
    this.hipRest = (rig.hip.getWorldPosition(this.joint).y - this.origin.y) / scale;
    this.sole = (rig.footL.getWorldPosition(this.joint).y - this.origin.y) / scale;
    this.feet = (['L', 'R'] as const).map(side => {
      const upper = rig[`leg${side}`], middle = rig[`shin${side}`], end = rig[`foot${side}`];
      const rest = upper.getWorldPosition(new Vector3()).sub(this.origin).applyQuaternion(this.frame.clone().invert()).divideScalar(scale);
      const a = middle.position.length(), b = end.position.length();
      return { ik: new LimbIK(upper, middle, end), a, b, rest, target: new Vector3(), planted: new Vector3(), stop: end.getWorldPosition(new Vector3()), start: end.getWorldPosition(new Vector3()), phase: -1, plantHeading: 0 };
    });
  }
  reset(): void { for (const foot of this.feet) foot.phase = -1; this.heading = undefined; this.moving = false; this.pelvisHeight = undefined; }
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
    const moving = speed > (this.moving ? .06 : .16), stopped = !moving && this.moving, started = moving && !this.moving;
    if (stopped) { this.stopTime = 0; for (const foot of this.feet) foot.stop.copy(foot.target); }
    if (started) { this.startTime = 0; for (const foot of this.feet) foot.start.copy(foot.target); }
    this.moving = moving; this.stopTime += dt; this.startTime += dt;
    const stance = .5 - .28 * run, lift = (.008 + .02 * run) * this.scale.y;
    for (const [index, foot] of this.feet.entries()) {
      const p = (phase + index * .5) % 1;
      this.previousTarget.copy(foot.target);
      this.lateral.set(foot.rest.x, 0, foot.rest.z).multiplyScalar(this.scale.y).applyQuaternion(this.frame);
      const neutral = this.delta.copy(this.origin).add(this.lateral); neutral.y = this.origin.y + this.sole * this.scale.y;
      if (!moving) {
        foot.target.copy(neutral);
        const u = Math.max(0, Math.min(1, (this.stopTime - index * .06) / .18));
        foot.target.lerp(foot.stop, 1 - u * u * (3 - 2 * u));
        foot.target.y += Math.sin(Math.PI * u) ** 2 * .02 * this.scale.y;
        foot.phase = -1;
      } else {
        if (turning || Math.abs(angle(foot.plantHeading)) > Math.PI / 4) foot.phase = -1;
        if (foot.phase < 0 || p < foot.phase) {
          foot.planted.copy(neutral).addScaledVector(this.forward, stride * (stance / 2 - p) * this.turnBlend);
          if (started) foot.planted.copy(foot.start);
          foot.plantHeading = heading;
        }
        if (p <= stance && !turning) foot.target.copy(foot.planted);
        else {
          const u = Math.max(0, (p - stance) / (1 - stance)), ease = u * u * (3 - 2 * u);
          // In actor space: heel-to-toe travel matches the stride; no prediction overshoot.
          const x = stride * (stance * (ease - .5) - (1 - stance) * (2 * u * u * u - 3 * u * u + u));
          foot.target.copy(neutral).addScaledVector(this.forward, x * this.turnBlend);
          foot.target.y += Math.sin(Math.PI * u) ** 2 * lift;
        }
        if (turning) {
          // Small alternating lift while turning; feet stay directly under the body.
          foot.target.lerp(neutral, 1 - this.turnBlend);
          foot.target.y += Math.max(0, Math.sin((phase + index * .5) * Math.PI * 2)) ** 2 * .018 * this.scale.y;
        }
        foot.phase = p;
      }
      if (turning) foot.target.lerp(this.previousTarget, Math.exp(-dt / .06));
      if (moving && this.startTime < .12) {
        const u = this.startTime / .12;
        foot.target.lerp(foot.start, 1 - u * u * (3 - 2 * u));
      }
      // Release a stale plant before it can create a lunge, including a teleported root.
      const maximum = (foot.a + foot.b) * this.scale.y * (moving && !turning && p > stance ? .8 : .55);
      this.offset.copy(foot.target).sub(neutral); this.offset.y = 0;
      const radius = this.offset.length();
      if (radius > maximum) {
        foot.target.addScaledVector(this.offset, maximum / radius - 1);
        foot.planted.copy(foot.target);
      }
    }
    // Highest pelvis that keeps both legs reachable. Aim for a soft 10° support
    // knee; unlike the pilot, swing lift never lowers the whole cycle's pelvis.
    let height = Infinity, minimumHeight = -Infinity, maximumHeight = Infinity;
    const support = moving && !turning && this.feet.some(foot => foot.phase >= 0 && foot.phase <= stance);
    for (const foot of this.feet) {
      if (support && foot.phase > stance) continue;
      foot.ik.upper.getWorldPosition(this.joint);
      const dx = foot.target.x - this.joint.x, dz = foot.target.z - this.joint.z;
      const compression = support ? Math.sin(Math.PI * Math.max(0, foot.phase) / stance) ** 2 : 0;
      const supportKnee = (10 + 15 * run + 20 * run * compression) * Math.PI / 180;
      const length = Math.sqrt(foot.a ** 2 + foot.b ** 2 + 2 * foot.a * foot.b * Math.cos(supportKnee)) * this.scale.y;
      const desired = foot.target.y + Math.sqrt(Math.max(.001, length * length - dx * dx - dz * dz));
      const offset = this.joint.y - rig.hip.getWorldPosition(this.delta).y;
      height = Math.min(height, desired - offset);
      const minLength = Math.sqrt(foot.a ** 2 + foot.b ** 2 + 2 * foot.a * foot.b * Math.cos((moving ? 24 + 21 * run : 50) * Math.PI / 180)) * this.scale.y;
      const maxLength = (foot.a + foot.b) * this.scale.y * .999;
      minimumHeight = Math.max(minimumHeight, foot.target.y + Math.sqrt(Math.max(.001, minLength * minLength - dx * dx - dz * dz)) - offset);
      maximumHeight = Math.min(maximumHeight, foot.target.y + Math.sqrt(Math.max(.001, maxLength * maxLength - dx * dx - dz * dz)) - offset);
    }
    if (moving && !turning && !support && stance < .49) {
      // During running flight neither ankle supports the pelvis. Lowering it
      // to reach both swing targets made the pilot drop on every toe-off.
      const u = ((phase % .5) - stance) / (.5 - stance);
      const foot = this.feet[0], knee = (10 + 15 * run) * Math.PI / 180;
      const reach = Math.sqrt(foot.a ** 2 + foot.b ** 2 + 2 * foot.a * foot.b * Math.cos(knee)) * this.scale.y;
      const half = Math.min(reach * .8, stride * stance / 2);
      height = this.origin.y + this.sole * this.scale.y - foot.rest.y * this.scale.y
        + this.hipRest * this.scale.y + Math.sqrt(reach * reach - half * half)
        + Math.sin(Math.PI * u) ** 2 * .02 * run;
    }
    const filtered = this.pelvisHeight === undefined ? height : this.origin.y + this.pelvisHeight
      + (height - this.origin.y - this.pelvisHeight) * (1 - Math.exp(-dt / .035));
    height = moving && !turning && !support ? filtered : Math.min(maximumHeight, Math.max(minimumHeight, filtered));
    this.pelvisHeight = height - this.origin.y;
    rig.hip.getWorldPosition(this.joint);
    const parentScale = rig.hip.parent!.getWorldScale(this.delta).y;
    this.heightOffset = (height - this.joint.y) / parentScale * weight;
    rig.hip.position.y += this.heightOffset; rig.hip.updateWorldMatrix(true, true);
    for (const foot of this.feet) {
      foot.ik.upper.getWorldPosition(this.joint);
      if (moving && foot.phase > stance) {
        const u = (foot.phase - stance) / (1 - stance);
        // Prescribe a smooth knee arc, then solve vertical ankle clearance from
        // the fitted bone lengths. This avoids hitting the IK straight-leg
        // singularity twice per swing (a visible knee snap in the pilot).
        const knee = (10 + 15 * run + (14 + 6 * run) * Math.sin(Math.PI * u) ** 2) * Math.PI / 180;
        const length = Math.sqrt(foot.a ** 2 + foot.b ** 2 + 2 * foot.a * foot.b * Math.cos(knee)) * this.scale.y;
        this.delta.copy(foot.target).sub(this.joint);
        foot.target.y = Math.max(this.origin.y + this.sole * this.scale.y,
          this.joint.y - Math.sqrt(Math.max(.001, length * length - this.delta.x ** 2 - this.delta.z ** 2)));
      }
      foot.ik.solve(foot.target, this.forward, this.frame, weight);
    }
  }
}
