import { Box3, Mesh, Vector3, type Object3D } from 'three';

/** Swinging paw clearance above the floor (m). */
const swingLift = .04;
/** Standing clips: a held paw re-steps once its authored spot is this far away (m); a step takes `stepTime` s and lifts `stepLift` m. */
const stepAt = .06, stepTime = .2, stepLift = .035, catchUpTime = .12;
const smooth = (t: number) => t * t * (3 - 2 * t);
/** Step height: up quickly, flat, down at the very end (a paw near the floor while it moves reads as sliding). */
const arc = (t: number) => stepLift * (1 - (2 * t - 1) ** 4);
/** Single-joint animal legs retain the authored rotations. A small positional
 * correction pins the paw during support, then eases away during swing. */
export class PawContacts {
  private readonly point = new Vector3();
  private readonly origin = new Vector3();
  private readonly offset = new Vector3();
  private readonly spot = new Vector3();
  private readonly feet;
  private clip = '';
  constructor(private readonly root: Object3D, template = root) {
    template.updateWorldMatrix(true, true); template.getWorldPosition(this.origin);
    this.feet = ['legFL', 'legFR', 'legBL', 'legBR'].flatMap(name => {
      const leg = root.getObjectByName(name), original = template.getObjectByName(name); if (!leg || !original) return [];
      const bounds = new Box3(); original.traverse(node => { if (node instanceof Mesh) bounds.expandByObject(node); });
      if (bounds.isEmpty()) return [];
      const paw = bounds.getCenter(new Vector3()); paw.y = bounds.min.y;
      return [{ leg, paw: original.worldToLocal(paw), reach: bounds.max.y - bounds.min.y, sole: bounds.min.y - this.origin.y, planted: new Vector3(), correction: new Vector3(), release: new Vector3(), phase: -1,
        /** Last drawn paw point (world), standing-hold state and the current settle step (-1: none). */
        last: null as Vector3 | null, held: false, step: -1, from: new Vector3(), fadeStart: 0 }];
    });
  }
  restore(): void { for (const foot of this.feet) { foot.leg.position.sub(foot.correction); foot.correction.set(0, 0, 0); } }
  reset(): void { for (const foot of this.feet) { foot.phase = -1; foot.release.set(0, 0, 0); foot.held = false; foot.last = null; } }
  stance(stride: number): number { return Math.min(.45, Math.min(...this.feet.map(f => f.reach)) * .75 / Math.max(.001, stride)); }
  update(phase: number, stride: number, clip: string, dt = 1 / 60): void {
    const offsets = clip === 'corgi-walk' ? [0, .5, .75, .25] : clip === 'corgi-gallop' ? [0, .1, .5, .6] : [0, .5, .5, 0];
    const stance = this.stance(stride); this.root.updateWorldMatrix(true, true); this.root.getWorldPosition(this.origin);
    const switched = clip !== this.clip; this.clip = clip;
    for (const [index, foot] of this.feet.entries()) {
      const p = (phase + offsets[index]) % 1, sole = this.origin.y + foot.sole;
      // A gait change (walk/trot/gallop use different foot offsets) or leaving a standing hold must not re-plant a
      // paw where the new clip happens to put it (a 20-45 cm one-frame jump): continue from where the paw is drawn,
      // planted there if this paw is in stance, otherwise fading out of its last correction from here.
      const resume = foot.last !== null && (foot.held || switched && foot.phase >= 0);
      foot.held = false;
      const fresh = !resume && (foot.phase < 0 || p < foot.phase);
      if (resume) { foot.planted.copy(foot.last!).setY(sole); foot.fadeStart = Math.max(stance, p); foot.step = -1; }
      if (fresh) {
        foot.planted.copy(foot.paw).applyMatrix4(foot.leg.matrixWorld).setY(sole); foot.fadeStart = stance; foot.step = -1;
        // Touchdown away from where a grounded paw is drawn (after a gait change): a short lifted catch-up step.
        if (foot.last && foot.last.y < sole + .015 && Math.hypot(foot.last.x - foot.planted.x, foot.last.z - foot.planted.z) > .03) { foot.from.copy(foot.last).setY(sole); foot.step = 0; }
      }
      if (p <= stance) {
        const world = this.point.copy(foot.planted);
        if (foot.step >= 0) {
          foot.step = Math.min(1, foot.step + dt / catchUpTime);
          world.lerpVectors(foot.from, foot.planted, smooth(foot.step)); world.y = sole + arc(foot.step);
          if (foot.step >= 1) foot.step = -1;
        }
        const target = foot.leg.parent!.worldToLocal(world);
        foot.correction.copy(target).sub(this.offset.copy(foot.paw).multiply(foot.leg.scale).applyQuaternion(foot.leg.quaternion)).sub(foot.leg.position);
        foot.release.copy(foot.correction);
      } else {
        foot.step = -1;
        const fade = Math.max(0, 1 - (p - Math.max(stance, foot.fadeStart)) / .15);
        foot.correction.copy(foot.release).multiplyScalar(fade * fade * (3 - 2 * fade));
      }
      foot.leg.position.add(foot.correction); foot.leg.updateWorldMatrix(false, true); foot.phase = p;
      // Swing clearance: a rigid leg passing under the body in its swing reaches the floor (the authored trot/walk
      // brushed the floor for ~4 frames there, dragging the paw 25-40 cm per step at body speed, QA "paw slide").
      // Keep the swinging paw above the floor, ramping in after lift-off and out before touchdown; in stance the
      // floor itself is the limit (the authored gallop can dip a paw under it).
      const swing = p > stance ? (p - stance) / Math.max(.001, 1 - stance) : 0;
      const clearance = swing > 0 ? swingLift * Math.min(1, Math.max(.4, swing / .1), (1 - swing) / .12) : 0;
      const dip = this.origin.y + foot.sole + clearance - this.point.copy(foot.paw).applyMatrix4(foot.leg.matrixWorld).y;
      if (dip > 0) {
        const parent = foot.leg.parent!, low = parent.worldToLocal(this.point.clone()), high = parent.worldToLocal(this.point.clone().setY(this.point.y + dip));
        high.sub(low); foot.leg.position.add(high); foot.correction.add(high); foot.leg.updateWorldMatrix(false, true);
      }
      (foot.last ??= new Vector3()).copy(foot.paw).applyMatrix4(foot.leg.matrixWorld);
    }
  }
  /** Standing clips (idle, sit, warnings) after the mixer: a paw stays where it stands on the floor while the body
   * moves over it (stop, creep, turning on the spot, the warning shifts), instead of following the root and skating.
   * Once its authored spot is more than 6 cm away it takes a short lifted step there, diagonal pairs at a time, so a
   * stop from a gait settles into the stance in steps rather than a one-frame jump. Authored lifts (bark) still lift. */
  hold(dt: number): void {
    this.root.updateWorldMatrix(true, true); this.root.getWorldPosition(this.origin);
    const floor = this.origin.y, partner = [3, 2, 1, 0];
    for (const [index, foot] of this.feet.entries()) {
      const spot = this.spot.copy(foot.paw).applyMatrix4(foot.leg.matrixWorld), lifted = spot.y, sole = floor + foot.sole;
      spot.y = sole;
      if (!foot.held) { foot.held = true; foot.step = -1; foot.planted.copy(foot.last && foot.last.distanceTo(spot) < 1 ? foot.last : spot).setY(sole); }
      const away = Math.hypot(spot.x - foot.planted.x, spot.z - foot.planted.z);
      if (away > 1) { foot.planted.copy(spot); foot.step = -1; }
      else if (foot.step < 0 && away > stepAt && this.feet.every((other, i) => other.step < 0 || i === partner[index])) { foot.step = 0; foot.from.copy(foot.planted); }
      const desired = this.point;
      if (foot.step >= 0) {
        foot.step = Math.min(1, foot.step + dt / stepTime);
        desired.lerpVectors(foot.from, spot, smooth(foot.step)); desired.y = sole + arc(foot.step);
        if (foot.step >= 1) { foot.planted.copy(spot); foot.step = -1; }
      } else desired.copy(foot.planted);
      desired.y = Math.max(desired.y, lifted);
      const target = foot.leg.parent!.worldToLocal(desired);
      foot.correction.copy(target).sub(this.offset.copy(foot.paw).multiply(foot.leg.scale).applyQuaternion(foot.leg.quaternion)).sub(foot.leg.position);
      foot.release.copy(foot.correction);
      foot.leg.position.add(foot.correction); foot.leg.updateWorldMatrix(false, true);
      (foot.last ??= new Vector3()).copy(foot.paw).applyMatrix4(foot.leg.matrixWorld);
    }
  }
  points(): number[][] { this.root.updateWorldMatrix(true, true); return this.feet.map(f => this.point.copy(f.paw).applyMatrix4(f.leg.matrixWorld).toArray()); }
}
