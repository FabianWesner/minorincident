import { Box3, Mesh, Quaternion, Vector3, type Matrix4, type Object3D } from 'three';

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
      const vertices: Vector3[] = [];
      original.traverse(node => {
        if (!(node instanceof Mesh)) return;
        const positions = node.geometry.attributes.position, indices = node.geometry.index;
        // Triangle indices repeat the same sole points. Retain each referenced
        // vertex once; every later minimum still considers the identical set.
        const seen = new Set<number>();
        for (let i = 0; i < (indices?.count ?? positions.count); i++) {
          const index = indices ? indices.getX(i) : i;
          if (seen.has(index)) continue; seen.add(index);
          vertices.push(original.worldToLocal(new Vector3().fromBufferAttribute(positions, index).applyMatrix4(node.matrixWorld)));
        }
      });
      // Jointed legs (amb.dog/inf.dog: shoulder/hip -> fore-arm/shin -> paw) hang from a shoulder or hip joint: moving the leg
      // joint itself detaches the whole limb from the body (PO 10-19 "detached leg of dog"), so their pin is a swing about it.
      // Only a drawn hierarchy (NpcView pets) can bend the knee; the instanced crowd bakes each leg as one rigid part.
      let knee: Object3D | null = null; if (root === template) leg.traverse(node => { if (!knee && node !== leg && /^(foreArm|shin)/.test(node.name)) knee = node; });
      const originalKnee = knee ? original.getObjectByName((knee as Object3D).name) : undefined, pawKnee = originalKnee ? originalKnee.worldToLocal(paw.clone()) : null;
      // The lower limb's vertices on the knee (sampled): its drawn sole once the knee bends.
      const kneeVertices: Vector3[] = [];
      originalKnee?.traverse(node => {
        if (!(node instanceof Mesh)) return;
        const positions = node.geometry.attributes.position, indices = node.geometry.index, count = indices?.count ?? positions.count;
        for (let i = 0; i < count; i += Math.max(1, Math.floor(count / 120))) kneeVertices.push(originalKnee.worldToLocal(new Vector3().fromBufferAttribute(positions, indices ? indices.getX(i) : i).applyMatrix4(node.matrixWorld)));
      });
      return [{ leg, vertices, jointed: knee !== null && pawKnee !== null, knee: knee as Object3D | null, pawKnee, kneeVertices, rest: leg.position.clone(), turned: new Quaternion(), kneeTurned: new Quaternion(), turning: false, paw: original.worldToLocal(paw), reach: bounds.max.y - bounds.min.y, sole: bounds.min.y - this.origin.y, planted: new Vector3(), correction: new Vector3(), release: new Vector3(), phase: -1,
        /** Last drawn paw point (world), standing-hold state and the current settle step (-1: none). */
        last: null as Vector3 | null, held: false, step: -1, from: new Vector3(), fadeStart: 0 }];
    });
  }
  restore(): void { for (const foot of this.feet) { foot.leg.position.sub(foot.correction); foot.correction.set(0, 0, 0); if (foot.turning) { foot.leg.quaternion.copy(foot.turned); foot.knee?.quaternion.copy(foot.kneeTurned); foot.turning = false; } } }
  /** Scene Lab guard: the largest distance (cm) of a jointed leg's joint from its bind position on the parent. */
  limbGapCm(): number {
    let gap = 0;
    for (const foot of this.feet) if (foot.jointed) {
      const parent = foot.leg.parent!; parent.updateWorldMatrix(true, false);
      gap = Math.max(gap, foot.leg.getWorldPosition(this.offset).distanceTo(parent.localToWorld(this.point.copy(foot.rest))) * 100);
    }
    return gap;
  }
  /** Jointed legs: replace the positional pin with a two-joint solve (shoulder/hip and elbow/knee, bend plane kept)
   * that puts the paw on the same point, so the limb stays on the body. */
  private swing(foot: (typeof this.feet)[number], floor: number): void {
    if (!foot.jointed || !foot.knee || foot.correction.lengthSq() < 1e-12) return;
    const leg = foot.leg, knee = foot.knee, target = this.target.copy(foot.paw).applyMatrix4(leg.matrixWorld);
    leg.position.sub(foot.correction); foot.correction.set(0, 0, 0); leg.updateWorldMatrix(false, true);
    if (!foot.turning) { foot.turned.copy(leg.quaternion); foot.kneeTurned.copy(knee.quaternion); foot.turning = true; }
    this.solve(foot, target);
    // The bent lower limb's own lowest vertex must stay on the floor (the rigid-leg dip check cannot see the knee bend).
    let bottom = this.lowest(foot.kneeVertices, knee.matrixWorld);
    if (bottom < floor) { target.y += floor - bottom; this.solve(foot, target); }
    // One re-solve can leave the bent toe a few mm low (the knee re-aims); a second settles it.
    bottom = this.lowest(foot.kneeVertices, knee.matrixWorld);
    if (bottom < floor) { target.y += floor - bottom; this.solve(foot, target); }
  }
  /** Exact Y component of Vector3.applyMatrix4, without unused X/Z work or arrays. */
  private lowest(vertices: readonly Vector3[], matrix: Matrix4): number {
    const e = matrix.elements; let bottom = Infinity;
    // Scene-graph transforms are affine. Their homogeneous divisor is exactly
    // one for every sole vertex; retain the general path for other matrices.
    if (e[3] === 0 && e[7] === 0 && e[11] === 0 && e[15] === 1) {
      for (const { x, y, z } of vertices) bottom = Math.min(bottom, e[1] * x + e[5] * y + e[9] * z + e[13]);
      return bottom;
    }
    for (const { x, y, z } of vertices) {
      const w = 1 / (e[3] * x + e[7] * y + e[11] * z + e[15]);
      bottom = Math.min(bottom, (e[1] * x + e[5] * y + e[9] * z + e[13]) * w);
    }
    return bottom;
  }
  private solve(foot: (typeof this.feet)[number], target: Vector3): void {
    const leg = foot.leg, knee = foot.knee!;
    const hip = leg.getWorldPosition(this.hip), joint = knee.getWorldPosition(this.joint), paw = this.pawWorld(foot, this.paw);
    const a = joint.distanceTo(hip), b = paw.distanceTo(joint), toTarget = this.axis.subVectors(target, hip), reach = toTarget.length();
    if (a < 1e-4 || b < 1e-4 || reach < 1e-4) return;
    const d = Math.max(Math.abs(a - b) + 1e-4, Math.min(a + b - 1e-4, reach)), u = toTarget.divideScalar(reach);
    // Bend direction: the current knee offset off the hip->target line (falls back to the current hip->paw bend).
    const bend = this.bend.subVectors(joint, hip); bend.addScaledVector(u, -bend.dot(u));
    if (bend.lengthSq() < 1e-10) bend.subVectors(joint, paw).addScaledVector(u, -this.offset.subVectors(joint, paw).dot(u));
    if (bend.lengthSq() < 1e-10) return;
    bend.normalize();
    const along = (a * a + d * d - b * b) / (2 * d), knee2 = this.offset.copy(hip).addScaledVector(u, along).addScaledVector(bend, Math.sqrt(Math.max(0, a * a - along * along)));
    this.rotateWorld(leg, this.from.subVectors(joint, hip), this.to.subVectors(knee2, hip));
    const joint2 = knee.getWorldPosition(this.joint), paw2 = this.pawWorld(foot, this.paw);
    this.rotateWorld(knee, this.from.subVectors(paw2, joint2), this.to.subVectors(target, joint2));
  }
  /** The drawn paw point: jointed legs carry it on the knee, which the swing may bend. */
  private pawWorld(foot: (typeof this.feet)[number], out: Vector3): Vector3 {
    return foot.jointed && foot.turning && foot.knee && foot.pawKnee ? foot.knee.localToWorld(out.copy(foot.pawKnee)) : out.copy(foot.paw).applyMatrix4(foot.leg.matrixWorld);
  }
  /** Turn a node so its world-space direction `from` points along `to` (about its own origin). */
  private rotateWorld(node: Object3D, from: Vector3, to: Vector3): void {
    if (from.lengthSq() < 1e-12 || to.lengthSq() < 1e-12) return;
    const world = this.turn.setFromUnitVectors(from.normalize(), to.normalize()), parent = node.parent!.getWorldQuaternion(this.parentTurn);
    node.quaternion.premultiply(world.premultiply(parent.clone().invert()).multiply(parent)); node.updateWorldMatrix(false, true);
  }
  private readonly target = new Vector3(); private readonly hip = new Vector3(); private readonly joint = new Vector3(); private readonly paw = new Vector3();
  private readonly axis = new Vector3(); private readonly bend = new Vector3(); private readonly from = new Vector3(); private readonly to = new Vector3();
  private readonly parentTurn = new Quaternion();
  private readonly turn = new Quaternion();
  reset(): void { for (const foot of this.feet) { foot.phase = -1; foot.release.set(0, 0, 0); foot.held = false; foot.last = null; } }
  /** Jointed (straight-legged) dogs hold a paw for a shorter part of the stride: their hip stands a full leg high, so a
   * paw planted further away than the attached leg reaches would drag. */
  stance(stride: number): number { return Math.min(.45, Math.min(...this.feet.map(f => f.reach)) * (this.feet.some(f => f.jointed) ? .5 : .75) / Math.max(.001, stride)); }
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
      // Keep swing clearance until touchdown; lowering early drags the drawn toe.
      const swing = p > stance ? (p - stance) / Math.max(.001, 1 - stance) : 0;
      const clearance = swing > 0 ? swingLift * Math.min(1, Math.max(.4, swing / .1)) : 0;
      // Rotation changes which sole vertex is lowest. The bind-pose centre can
      // stay above the floor while the drawn toe penetrates it by several cm.
      const bottom = this.lowest(foot.vertices, foot.leg.matrixWorld);
      this.point.copy(foot.paw).applyMatrix4(foot.leg.matrixWorld);
      const dip = this.origin.y + foot.sole + clearance - Math.min(bottom, this.point.y);
      if (dip > 0) {
        const parent = foot.leg.parent!, low = parent.worldToLocal(this.point.clone()), high = parent.worldToLocal(this.point.clone().setY(this.point.y + dip));
        high.sub(low); foot.leg.position.add(high); foot.correction.add(high); foot.leg.updateWorldMatrix(false, true);
      }
      this.swing(foot, sole);
      this.pawWorld(foot, foot.last ??= new Vector3());
    }
  }
  /** Standing clips (idle, sit, warnings) after the mixer: a paw stays where it stands on the floor while the body
   * moves over it (stop, creep, turning on the spot, the warning shifts), instead of following the root and skating.
   * Once its authored spot is more than 6 cm away it takes a short lifted step there, diagonal pairs at a time, so a
   * stop from a gait settles into the stance in steps rather than a one-frame jump. Authored lifts (bark) still lift. */
  hold(dt: number, grounded = false): void {
    this.root.updateWorldMatrix(true, true); this.root.getWorldPosition(this.origin);
    const floor = this.origin.y, partner = [3, 2, 1, 0];
    for (const [index, foot] of this.feet.entries()) {
      const spot = this.spot.copy(foot.paw).applyMatrix4(foot.leg.matrixWorld), lifted = spot.y, sole = floor + foot.sole;
      spot.y = sole;
      // The spawn capsule settles vertically before standing still. Keep the
      // horizontal anchor, but follow its floor rather than the spawn height.
      foot.planted.y = sole; foot.from.y = sole;
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
      if (grounded) {
        // A folded rear paw has a different lowest vertex from the bind pose.
        // Ground the drawn sole, retaining clearance during a settling step.
        const bottom = this.lowest(foot.vertices, foot.leg.matrixWorld);
        desired.y = lifted + floor - bottom + Math.max(0, desired.y - sole);
      } else desired.y = Math.max(desired.y, lifted);
      const target = foot.leg.parent!.worldToLocal(desired);
      foot.correction.copy(target).sub(this.offset.copy(foot.paw).multiply(foot.leg.scale).applyQuaternion(foot.leg.quaternion)).sub(foot.leg.position);
      foot.release.copy(foot.correction);
      foot.leg.position.add(foot.correction); foot.leg.updateWorldMatrix(false, true);
      if (!grounded) {
        const bottom = this.lowest(foot.vertices, foot.leg.matrixWorld);
        const dip = sole + (foot.step >= 0 ? arc(foot.step) : 0) - bottom;
        if (dip > 0) {
          const parent = foot.leg.parent!, low = parent.worldToLocal(this.point.copy(foot.paw).applyMatrix4(foot.leg.matrixWorld).clone());
          const high = parent.worldToLocal(this.point.clone().setY(this.point.y + dip)).sub(low);
          foot.leg.position.add(high); foot.correction.add(high); foot.leg.updateWorldMatrix(false, true);
        }
      }
      this.swing(foot, sole);
      this.pawWorld(foot, foot.last ??= new Vector3());
    }
  }
  points(): number[][] { this.root.updateWorldMatrix(true, true); return this.feet.map(f => this.pawWorld(f, this.point).toArray()); }
}
