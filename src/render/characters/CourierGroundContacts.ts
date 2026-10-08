import { Quaternion, Vector3, type Object3D } from 'three';
import type { CharacterRig } from './rig';
import { LimbIK } from './LimbIK';

/** World-locked feet with stepping release. A locked foot never translates or
 * yaws; it leaves the ground only by a gait swing (distance-driven phase) or by a
 * timed step when the body has twisted or drifted too far from it (turns in place,
 * settling after a stop, aim snaps). One foot steps at a time while walking or
 * standing. Swing feet lift on a real knee arc, roll heel-to-toe and land on the
 * current heading, so turns become footwork rather than a rotating pivot. */
interface Swing { from: Vector3; fromYaw: number; fromPitch: number; offset: Vector3; start: number; duration: number; gait: boolean; u: number; knee0: number; dip: number; land: Vector3 | undefined; releaseP: number; landYaw?: number; last?: Vector3; approach?: { from: Vector3; v: Vector3; to: Vector3; u0: number; T: number } }
interface Foot {
  ik: LimbIK; a: number; b: number; rest: Vector3; side: number;
  target: Vector3; yaw: number; pitch: number;
  locked: boolean; fresh: boolean; planted: Vector3; plantYaw: number; phase: number; swing: Swing | undefined; hold?: boolean;
}
const DEG = Math.PI / 180;
const ease = (u: number): number => { const t = Math.max(0, Math.min(1, u)); return t * t * (3 - 2 * t); };
const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));
/** Resting toe-out per foot (radians); twist limits that trigger a step, and the pivot clamp beyond which a locked foot must yaw. */
const toeOut = .09, twistStep = 24 * DEG, twistStepMoving = 32 * DEG, twistPivot = 70 * DEG;
/** Optional per-figure gait style (crowds). Defaults reproduce the courier exactly. */
export interface GaitStyle {
  /** Stance fraction of the gait cycle (default .52 - .25 * run). */
  stance?: number;
  /** Swing knee peak multiplier (default 1). */
  knee?: number;
  /** Dragged foot (0 = left, 1 = right) and how much it drags (0..1): low knee, low clearance, toes scraping. */
  dragFoot?: number;
  drag?: number;
  /** Longest gait swing (s): an early (out-of-reach) release lands in time instead of hanging for the rest of the cycle. */
  maxSwing?: number;
}
export class CourierGroundContacts {
  private readonly feet: Foot[];
  private readonly origin = new Vector3();
  private readonly forward = new Vector3();
  private readonly frame = new Quaternion();
  private readonly scale = new Vector3();
  private readonly joint = new Vector3();
  private readonly delta = new Vector3();
  private readonly neutral = new Vector3();
  private readonly landing = new Vector3();
  private readonly pole = new Vector3();
  private readonly footFrame = new Quaternion();
  private readonly footPitch = new Quaternion();
  private readonly up = new Vector3(0, 1, 0);
  private readonly lateralAxis = new Vector3(0, 0, 1);
  private readonly sole: number;
  private readonly hipRest: number;
  private pelvisHeight: number | undefined;
  private heading: number | undefined;
  private moving = false;
  private time = 0;
  private lastLanding = -1;
  private shift = 0;
  /** Diagnostics for tests and evidence: pivot clamps on locked feet, steps taken. */
  pivots = 0;
  steps = 0;
  /** `scaleNode` carries the leg-length world scale (crowd skeletons keep the asset scale below the instance frame). */
  constructor(private rig: CharacterRig, private scaleNode: Object3D = rig.root) {
    rig.root.updateWorldMatrix(true, true);
    rig.root.getWorldPosition(this.origin); rig.root.getWorldQuaternion(this.frame);
    const scale = scaleNode.getWorldScale(this.scale).y;
    this.hipRest = (rig.hip.getWorldPosition(this.joint).y - this.origin.y) / scale;
    this.sole = (rig.footL.getWorldPosition(this.joint).y - this.origin.y) / scale;
    this.feet = (['L', 'R'] as const).map((side, index) => {
      const upper = rig[`leg${side}`], middle = rig[`shin${side}`], end = rig[`foot${side}`];
      const rest = upper.getWorldPosition(new Vector3()).sub(this.origin).applyQuaternion(this.frame.clone().invert()).divideScalar(scale);
      return { ik: new LimbIK(upper, middle, end), a: middle.position.length(), b: end.position.length(), rest, side: index === 0 ? 1 : -1,
        target: new Vector3(), yaw: 0, pitch: 0, locked: false, fresh: true, planted: new Vector3(), plantYaw: 0, phase: -1, swing: undefined };
    });
  }
  /** Crowds share one off-scene skeleton per batch: a figure that changes batch (LOD) keeps its contacts on the new skeleton. */
  rebind(rig: CharacterRig, scaleNode: Object3D): void {
    if (rig === this.rig) return;
    this.rig = rig; this.scaleNode = scaleNode;
    (['L', 'R'] as const).forEach((side, i) => { this.feet[i].ik = new LimbIK(rig[`leg${side}`], rig[`shin${side}`], rig[`foot${side}`]); });
  }
  /** Contacts resume from the clip pose on the next grounded frame. */
  reset(): void { for (const foot of this.feet) { foot.locked = false; foot.fresh = true; foot.swing = undefined; foot.phase = -1; } this.heading = undefined; this.moving = false; this.pelvisHeight = undefined; this.shift = 0; }
  /** Ankle target (world), yaw, pitch and lock state of foot `index`, for tests and evidence. */
  contact(index: number): { target: Vector3; yaw: number; locked: boolean; pitch: number } { const f = this.feet[index]; return { target: f.target, yaw: f.yaw, locked: f.locked, pitch: f.pitch }; }
  update(phase: number, stride: number, run: number, weight: number, speed: number, dt: number, style?: GaitStyle): void {
    const rig = this.rig;
    this.time += dt;
    rig.root.updateWorldMatrix(true, true);
    rig.root.getWorldPosition(this.origin); rig.root.getWorldQuaternion(this.frame); this.scaleNode.getWorldScale(this.scale);
    const s = this.scale.y, ground = this.origin.y + this.sole * s;
    this.forward.set(1, 0, 0).applyQuaternion(this.frame); this.forward.y = 0; this.forward.normalize();
    const heading = Math.atan2(-this.forward.z, this.forward.x);
    const yawRate = this.heading === undefined ? 0 : wrap(heading - this.heading) / Math.max(dt, 1e-4); this.heading = heading;
    const moving = speed > (this.moving ? .06 : .16), stopped = !moving && this.moving;
    this.moving = moving;
    const stance = style?.stance ?? .52 - .25 * run, reach = (this.feet[0].a + this.feet[0].b) * s;
    const legLength = (foot: Foot, knee: number): number => Math.sqrt(foot.a ** 2 + foot.b ** 2 + 2 * foot.a * foot.b * Math.cos(knee)) * s;
    /** Knee flexion for a hip-to-ankle distance (world). */
    const kneeOf = (foot: Foot, distance: number): number => { const d = Math.min(distance / s, foot.a + foot.b); return Math.PI - Math.acos(Math.max(-1, Math.min(1, (foot.a ** 2 + foot.b ** 2 - d * d) / (2 * foot.a * foot.b)))); };
    const kneeNow = (foot: Foot): number => kneeOf(foot, foot.ik.upper.getWorldPosition(this.joint).distanceTo(foot.target));
    // Swing knee peaks (chibi legs: a readable arc, not motion-capture clearance).
    const drag = (foot: Foot): number => style?.drag && this.feet.indexOf(foot) === style.dragFoot ? style.drag : 0;
    const peakKnee = (gait: boolean, foot: Foot): number => (gait ? (68 + 17 * run) * (style?.knee ?? 1) * (1 - .55 * drag(foot)) : 50) * DEG;
    // Heel-off/strike angles shrink at run: its stance lasts ~0.1 s, so the rolls would otherwise snap.
    const heelOff = (24 - 8 * run) * DEG, heelStrike = (10 - 4 * run) * DEG, strikeWindow = stance * (.18 + .22 * run);
    const neutralOf = (foot: Foot, out: Vector3): Vector3 => {
      out.set(foot.rest.x, 0, foot.rest.z).multiplyScalar(s).applyQuaternion(this.frame).add(this.origin); out.y = ground; return out;
    };
    /** Where the gait plants this foot at phase `p` (world). */
    const gaitPlant = (foot: Foot, p: number, out: Vector3): Vector3 => neutralOf(foot, out).addScaledVector(this.forward, moving ? stride * (stance / 2 - Math.min(p, stance)) : 0);
    const lock = (foot: Foot, yaw: number): void => { foot.locked = true; foot.swing = undefined; foot.planted.copy(foot.target); foot.planted.y = ground; foot.plantYaw = foot.yaw = yaw; };
    for (const foot of this.feet) {
      // Fresh contacts (first frame, after riding/kicks, teleports): lock where the foot is now.
      if (foot.fresh) { foot.ik.end.getWorldPosition(foot.target); foot.pitch = 0; lock(foot, heading + toeOut * foot.side); foot.fresh = false; }
      if (!foot.locked) continue;
      this.delta.copy(foot.planted).sub(neutralOf(foot, this.neutral)); this.delta.y = 0;
      if (this.delta.length() > reach * 1.1) {
        // Crowds never teleport a planted foot: it catches up with a quick step instead.
        if (style?.maxSwing) { foot.swing = { from: foot.target.clone(), fromYaw: foot.yaw, fromPitch: foot.pitch, offset: new Vector3(), start: this.time, duration: .12, gait: false, u: 0, knee0: kneeNow(foot), dip: 0, land: undefined, releaseP: 0 }; foot.locked = false; this.steps++; }
        else { foot.target.copy(this.neutral); foot.pitch = 0; lock(foot, heading + toeOut * foot.side); }
      }
    }
    // A stop mid-swing finishes as a short timed step.
    if (stopped) for (const foot of this.feet) {
      if (!foot.swing?.gait) continue;
      Object.assign(foot.swing, { gait: false, start: this.time, duration: .15, u: 0, knee0: kneeNow(foot), fromYaw: foot.yaw, fromPitch: foot.pitch, land: undefined, releaseP: 0 });
      foot.swing.from.copy(foot.target);
    }
    // Gait release: a locked foot past its stance fraction swings (release offset keeps it continuous).
    for (const [index, foot] of this.feet.entries()) {
      const p = (phase + index * .5) % 1;
      // Also release a foot the leg can no longer reach (first steps from standstill plant earlier than the cycle would).
      const stretched = moving && foot.locked && Math.hypot(foot.planted.x - foot.ik.upper.getWorldPosition(this.joint).x, foot.planted.z - this.joint.z) > reach * .68;
      // A foot that landed early (maxSwing) waits for its next stance window instead of releasing again at once.
      if (foot.hold && (p <= stance || !moving)) foot.hold = false;
      if (moving && foot.locked && (p > stance && !foot.hold || stretched)) {
        gaitPlant(foot, stance, this.landing);
        foot.swing = { from: foot.target.clone(), fromYaw: foot.yaw, fromPitch: foot.pitch, offset: foot.target.clone().sub(this.landing), start: this.time, duration: 0, gait: true, u: 0, knee0: kneeNow(foot), dip: 0, land: undefined, releaseP: Math.min(p, .9) };
        foot.locked = false;
      }
    }
    // Twist or drift beyond comfort: one timed step at a time (both feet airborne only in running flight).
    const anyAir = this.feet.some(f => !f.locked);
    let candidate: Foot | undefined, score = 0;
    for (const foot of this.feet) {
      if (!foot.locked) continue;
      const twist = Math.abs(wrap(heading + toeOut * foot.side - foot.plantYaw));
      this.delta.copy(foot.planted).sub(neutralOf(foot, this.neutral)); this.delta.y = 0;
      const drift = this.delta.length() / s, limit = moving ? twistStepMoving : twistStep;
      if (!(twist > limit || !moving && drift > .055 && this.time - this.lastLanding > .08)) continue;
      if (anyAir && twist < twistPivot && !(moving && run > .5)) continue;
      // Crowds at a run: the next gait swing (a few tenths of a second away) re-aims the foot; a timed step there trips over the stride.
      if (style?.maxSwing && moving && (run > .5 || anyAir) && twist < twistPivot) continue;
      const value = twist / limit + drift + (Math.sign(yawRate) === foot.side ? .1 : 0);
      if (value > score) { score = value; candidate = foot; }
    }
    const step = (foot: Foot, duration: number): void => {
      foot.swing = { from: foot.target.clone(), fromYaw: foot.yaw, fromPitch: foot.pitch, offset: new Vector3(), start: this.time, duration, gait: false, u: 0, knee0: kneeNow(foot), dip: 0, land: undefined, releaseP: 0 };
      foot.locked = false; this.steps++;
    };
    if (candidate) step(candidate, moving ? .14 : .17);
    // Crowds never pivot a planted foot: past the pivot limit it hops onto the new heading (a quick step, even mid-stride).
    if (style?.maxSwing) for (const foot of this.feet) if (foot.locked && Math.abs(wrap(heading + toeOut * foot.side - foot.plantYaw)) > twistPivot) step(foot, .12);
    const toe = .085 * s, heel = .05 * s, soleDepth = this.sole * s;
    /** Ankle offset (foot frame) when the foot rests on its heel, pitched `phi` toes-up. */
    const strikeDelta = (phi: number, out: Vector3): Vector3 => out.set(heel * Math.cos(phi) - soleDepth * Math.sin(phi) - heel, heel * Math.sin(phi) + soleDepth * Math.cos(phi) - soleDepth, 0);
    for (const [index, foot] of this.feet.entries()) {
      const p = (phase + index * .5) % 1, previous = foot.phase;
      foot.phase = moving ? p : -1;
      const landYaw = heading + toeOut * foot.side;
      if (foot.swing) {
        const swing = foot.swing;
        let u: number, landed: boolean;
        if (swing.gait) {
          landed = previous >= 0 && p < previous;
          // Progress from the release phase: a stance fraction shifting under a walk/run blend must not stall the swing.
          u = landed ? 1 : Math.max(0, (p - swing.releaseP) / (1 - swing.releaseP));
          if (style?.maxSwing && !landed) { u = Math.max(u, (this.time - swing.start) / style.maxSwing); if (u >= 1) { u = 1; landed = true; foot.hold = true; } }
          // Land where the swing arrived (no touchdown jump); the stance holds that plant.
          if (!landed) {
            // Actor-space swing matching the stance velocity at toe-off and, when walking, at heel strike
            // (the release offset fades out). Short legs cannot reach the body-space overshoot a fully
            // matched running touchdown needs, so a run lands with part of the body speed instead.
            const match = 1 - .5 * run * ease((u - .5) / .5);
            const x = stride * (stance * (ease(u) - .5) - (1 - stance) * (2 * u * u * u - 3 * u * u + u) * match);
            neutralOf(foot, foot.target).addScaledVector(this.forward, x).addScaledVector(swing.offset, 1 - ease(u));
            if (style?.maxSwing) {
              // Crowds: the last part of the swing approaches a fixed world landing point (Hermite from the current
              // foot velocity to rest), so a turning or running body cannot carry the arriving foot along the ground.
              if (!swing.approach && u >= .6) {
                // Landing point: where the stance will plant this foot when its phase wraps, along the body's current turn.
                // The swing ends at the phase wrap or at the swing time cap, whichever comes first.
                const rate = dt > 0 && u > swing.u ? (u - swing.u) / dt : 0, left = Math.max(0, Math.min((1 - p) * stride / Math.max(speed, .05), style.maxSwing - (this.time - swing.start)));
                const remain = speed * left, turn = Math.max(-1.2, Math.min(1.2, yawRate * left));
                const to = new Vector3(foot.rest.x, 0, foot.rest.z).multiplyScalar(s).applyQuaternion(this.footFrame.setFromAxisAngle(this.up, turn).multiply(this.frame)).add(this.origin);
                to.addScaledVector(this.landing.copy(this.forward).applyAxisAngle(this.up, turn / 2), remain).addScaledVector(this.landing.copy(this.forward).applyAxisAngle(this.up, turn), stride * stance / 2); to.y = ground;
                const v = swing.last && dt > 0 ? foot.target.clone().sub(swing.last).divideScalar(dt) : new Vector3(); v.y = 0; v.clampLength(0, 6);
                swing.approach = { from: foot.target.clone(), v, to, u0: u, T: Math.min(.25, rate > 0 ? (1 - u) / rate : .1) };
              }
              const a = swing.approach;
              if (a) {
                const t = Math.min(1, (u - a.u0) / Math.max(1e-4, 1 - a.u0)), t2 = t * t, t3 = t2 * t, h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = 3 * t2 - 2 * t3;
                foot.target.x = h00 * a.from.x + h10 * a.v.x * a.T + h01 * a.to.x; foot.target.z = h00 * a.from.z + h10 * a.v.z * a.T + h01 * a.to.z;
              }
              (swing.last ??= new Vector3()).copy(foot.target);
            }
          }
        } else {
          u = Math.min(1, (this.time - swing.start) / swing.duration); landed = u >= 1;
          // Travel and yaw happen mid-step, once the foot is off the ground.
          if (u < .5 || !swing.land) {
            swing.land = gaitPlant(foot, p, swing.land ?? new Vector3());
            // Crowds stepping while on the move aim where the body will be when the step lands.
            if (style?.maxSwing && moving) swing.land.addScaledVector(this.forward, speed * (1 - u) * swing.duration);
          }
          foot.target.copy(swing.from).lerp(swing.land, ease((u - .12) / .76));
        }
        // Crowds latch the landing heading late in the swing, so a foot never yaws once it is down.
        if (style?.maxSwing && u >= .7) swing.landYaw ??= landYaw;
        foot.yaw = swing.fromYaw + wrap((swing.landYaw ?? landYaw) - swing.fromYaw) * ease((u - .12) / .76);
        // Toes trail at toe-off, then the heel leads into contact.
        const strikePitch = swing.gait || moving ? heelStrike : heelStrike * .5;
        foot.pitch = u < .5 ? swing.fromPitch * (1 - ease(u / .5)) : strikePitch * ease((u - .5) / .35);
        // A dragged foot keeps its toes down through the swing (the toe scrapes forward, no heel strike).
        const dragged = swing.gait ? drag(foot) : 0;
        if (dragged) foot.pitch += (-(18 * DEG) * Math.sin(Math.PI * u) - foot.pitch) * dragged;
        // The lowest sole point rides the arc: a pitched foot needs its ankle raised.
        // The lowest sole point must clear the ground: a pitched foot needs its ankle raised.
        swing.dip = Math.max(0, foot.pitch < 0 ? toe * Math.sin(-foot.pitch) - soleDepth * (1 - Math.cos(foot.pitch)) : heel * Math.sin(foot.pitch) - soleDepth * (1 - Math.cos(foot.pitch)));
        foot.target.y = ground + swing.dip; swing.u = u;
        if (landed) {
          // The heel contact stays where the swing put it: the plant is that heel's flat-foot ankle.
          if (foot.pitch > 0) foot.target.sub(strikeDelta(foot.pitch, this.delta).applyQuaternion(this.footFrame.setFromAxisAngle(this.up, landYaw)));
          // Plant on the yaw the foot arrived with (a fast turn keeps rotating during the last frames).
          lock(foot, foot.yaw); if (!moving) foot.pitch = 0; this.lastLanding = this.time;
        }
      }
      if (foot.locked) {
        // Hold the plant; only the pivot clamp lets a planted foot yaw (counted).
        let twist = wrap(landYaw - foot.plantYaw);
        if (Math.abs(twist) > twistPivot) { foot.plantYaw += twist - Math.sign(twist) * twistPivot; this.pivots++; twist = Math.sign(twist) * twistPivot; }
        foot.yaw = foot.plantYaw; foot.target.copy(foot.planted); foot.pitch = 0;
        if (moving && p <= stance) {
          // Heel-to-toe roll: the heel strike settles flat, then the heel rises towards toe-off.
          const roll = ease((p - stance * .55) / (stance * .45)), strike = 1 - ease(p / strikeWindow);
          foot.pitch = heelStrike * strike - heelOff * roll;
          this.footFrame.setFromAxisAngle(this.up, foot.yaw);
          if (roll > 0) {
            // The ankle sits above and behind the toe contact; rotate it about the toe.
            const theta = heelOff * roll;
            this.delta.set(-toe * Math.cos(theta) + soleDepth * Math.sin(theta) + toe, toe * Math.sin(theta) + soleDepth * Math.cos(theta) - soleDepth, 0).applyQuaternion(this.footFrame);
            foot.target.add(this.delta);
          } else if (strike > 0) foot.target.add(strikeDelta(heelStrike * strike, this.delta).applyQuaternion(this.footFrame));
        }
      }
    }
    // Pelvis: the highest height that keeps every supporting leg on a softly bent knee,
    // lower through mid-stance so the body does not vault over the short legs, and
    // already descending as a swing foot reaches for its heel strike.
    const locked = this.feet.filter(f => f.locked);
    let height = Infinity, minimumHeight = -Infinity, maximumHeight = Infinity;
    for (const foot of this.feet) {
      const reaching = !foot.locked && foot.swing ? ease((foot.swing.u - .4) / .45) : 0;
      if (!foot.locked && reaching <= 0) continue;
      foot.ik.upper.getWorldPosition(this.joint);
      // A swing foot is judged at its landing point (the body-space swing path overshoots before heel strike).
      const point = foot.locked ? foot.target : gaitPlant(foot, 0, this.landing);
      const dx = point.x - this.joint.x, dz = point.z - this.joint.z, offset = this.joint.y - rig.hip.getWorldPosition(this.delta).y;
      const compression = moving && foot.locked && foot.phase >= 0 && foot.phase <= stance ? Math.sin(Math.PI * foot.phase / stance) ** 2 : 0;
      const supportKnee = (foot.locked ? 14 + 15 * run + (16 + 10 * run) * compression : 22) * DEG;
      const desired = foot.target.y + Math.sqrt(Math.max(.001, legLength(foot, supportKnee) ** 2 - dx * dx - dz * dz)) - offset;
      if (foot.locked) {
        height = Math.min(height, desired);
        if (!moving) minimumHeight = Math.max(minimumHeight, foot.target.y + Math.sqrt(Math.max(.001, legLength(foot, 50 * DEG) ** 2 - dx * dx - dz * dz)) - offset);
        maximumHeight = Math.min(maximumHeight, foot.target.y + Math.sqrt(Math.max(.001, legLength(foot, (14 + 10 * run) * DEG) ** 2 - dx * dx - dz * dz)) - offset);
      } else height = Math.min(height, desired + (1 - reaching) * .12);
    }
    if (!locked.length && this.pelvisHeight !== undefined) {
      // Flight (running): hold the pelvis on its arc with a slight rise; the reaching foot brings it down for heel strike.
      height = Math.min(height, this.origin.y + this.pelvisHeight + .2 * dt);
    }
    // Settle down quickly (heel strike), rise smoothly.
    const current = this.pelvisHeight === undefined ? height : this.origin.y + this.pelvisHeight;
    const filtered = current + (height - current) * (1 - Math.exp(-dt / (height < current ? .03 : .05)));
    height = locked.length ? Math.min(maximumHeight, Math.max(minimumHeight, filtered)) : filtered;
    this.pelvisHeight = height - this.origin.y;
    rig.hip.getWorldPosition(this.joint);
    const parentScale = rig.hip.parent!.getWorldScale(this.delta).y;
    rig.hip.position.y += (height - this.joint.y) / parentScale * weight;
    // Standing steps shift the weight over the supporting foot.
    const shiftTarget = !moving && locked.length === 1 ? locked[0].side * .028 : 0;
    this.shift += (shiftTarget - this.shift) * (1 - Math.exp(-dt / .09));
    rig.hip.position.z -= this.shift * s / parentScale * weight;
    rig.hip.updateWorldMatrix(true, true);
    for (const foot of this.feet) {
      if (!foot.locked && foot.swing) {
        // Swing height follows a knee profile (release flex -> peak -> the landing flex the
        // geometry needs), so the knee never races through the straight-leg singularity.
        const swing = foot.swing, u = swing.u;
        foot.ik.upper.getWorldPosition(this.joint);
        const dx = foot.target.x - this.joint.x, dz = foot.target.z - this.joint.z, floor = ground + swing.dip;
        const landing = kneeOf(foot, Math.hypot(dx, dz, this.joint.y - floor));
        // Guaranteed clearance through the swing, on top of the readable knee arc.
        const dragged = swing.gait ? drag(foot) : 0;
        // A dragged foot scrapes just above the ground (toes down), lifting off and touching down quickly.
        const clearance = dragged ? Math.max(.016, (.025 + .02 * run) * (1 - .8 * dragged) * s) * Math.min(1, u / .04, (1 - u) / .06)
          : Math.max(style?.maxSwing ? .022 : 0, (swing.gait ? .025 + .02 * run : .02) * s) * Math.min(1, u / .1, (1 - u) / .12);
        const needed = kneeOf(foot, Math.hypot(dx, dz, this.joint.y - floor - clearance));
        const peak = Math.max(peakKnee(swing.gait, foot), swing.knee0);
        const profile = swing.knee0 + (peak - swing.knee0) * ease(u / .35);
        // The leg must still span the horizontal distance with the foot no higher than ~14 cm: a trailing
        // foot at a running toe-off folds less rather than kicking up to a hard height cap.
        const horizontalNow = Math.hypot(dx, dz), ceiling = kneeOf(foot, Math.hypot(horizontalNow, Math.max(.1 * s, this.joint.y - floor - .14 * s)));
        const knee = Math.max(needed, 14 * DEG, Math.min(Math.max(needed, ceiling), u < .5 ? profile : profile + (landing - profile) * ease((u - .5) / .5)));
        const length = legLength(foot, knee);
        foot.target.y = Math.max(floor + clearance, this.joint.y - Math.sqrt(Math.max(0, length * length - dx * dx - dz * dz)));
        // Crowds: a foot the leg cannot reach trails low (the reach clamp below) instead of kicking up towards the hip.
        if (style?.maxSwing) foot.target.y = Math.min(foot.target.y, floor + Math.max(clearance, .15 * s));
        // Out of reach (fast toe-off at a run): the foot trails closer under the body at this height,
        // folding the shin, instead of being pulled up the leg line (which snapped the knee when it let go).
        const dy = foot.target.y - this.joint.y, limit = legLength(foot, 14 * DEG), horizontal = Math.hypot(dx, dz);
        const allowed = Math.sqrt(Math.max(0, limit * limit - dy * dy));
        if (horizontal > allowed) { foot.target.x = this.joint.x + dx * allowed / horizontal; foot.target.z = this.joint.z + dz * allowed / horizontal; }
      }
      this.footFrame.setFromAxisAngle(this.up, foot.yaw).multiply(this.footPitch.setFromAxisAngle(this.lateralAxis, foot.pitch));
      // Knee between the body heading and the foot's own direction.
      this.pole.set(1, 0, 0).applyQuaternion(this.footFrame); this.pole.y = 0; this.pole.add(this.forward).normalize();
      foot.ik.solve(foot.target, this.pole, this.footFrame, weight);
    }
  }
}
