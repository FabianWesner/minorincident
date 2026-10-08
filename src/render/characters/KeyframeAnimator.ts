import { AdditiveAnimationBlendMode, AnimationMixer, LoopOnce, LoopRepeat, Quaternion, Vector3, type AnimationAction, type Object3D } from 'three';
import { meleeChains } from '../../data/meleeCombos';
import type { AnimationState, SurvivorState } from '../../data/survivor';
import { authoredClips, retargetClip, skinClips, skinGait, settleGroundPose, strides, strideScale } from './clips';
import type { CharacterRig } from './rig';
import { CourierGroundContacts } from './CourierGroundContacts';
import { chainNodes, courierBones, shoulderOffset, type CourierBones } from './CourierRig';

const locoStates = new Set(['idle', 'walk', 'run', 'start', 'stop', 'turn-left', 'turn-right']);
const smooth = (a: number, b: number, x: number): number => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** Rider state from the bicycle (crank angle in radians, steer −1..1). */
export interface RidePose { pedal: number; steer: number }
/** Authored glTF actions, 140 ms crossfades, speed-matched strides and upper-body layers.
 * The explicit sim clock supports paused stepping and visual hit-stop. */
export class KeyframeAnimator {
  readonly mixer: AnimationMixer;
  private readonly actions = new Map<string, AnimationAction>();
  private base: AnimationAction | undefined;
  private overlay: AnimationAction | undefined;
  private attackTick = -1;
  private actionTick = -1;
  private lastTime = 0;
  /** Presentation clock of the last evaluation (s). */
  get time(): number { return this.lastTime; }
  private moving = false;
  private phase = 0;
  private readonly worldPosition = new Vector3();
  private lastPosition: { x: number; z: number } | undefined;
  private transitionUntil = 0;
  private secondary = 0;
  private secondaryVelocity = 0;
  private readonly backpack: Object3D | undefined;
  private readonly backpackRest: number;
  private carryWeight = 0;
  private contactWeight = 1;
  private mode = '';
  private locoSpeed = 0;
  private locoWeight = 1;
  private lunge = 0;
  private readonly scaleScratch = new Vector3();
  private readonly chest = new Vector3();
  private readonly spine = new Vector3();
  private readonly postureRotation = new Quaternion();
  private readonly postureAxis = new Vector3(0, 0, 1);
  private readonly carryPose: [Object3D, Quaternion][] = [];
  state: AnimationState = 'idle';
  clip = 'idle';
  evaluations = 0;
  missingClips = 0;
  /** `clipSource` overrides library clips by name (skin pilot: retargeted Mesh2Motion locomotion). */
  private readonly strides: Record<string, number>;
  private readonly skin: boolean;
  private riding = false;
  private rideChangedAt = -1;
  rideWeight = 0;
  private readonly ground: CourierGroundContacts | undefined;
  /** Skeleton v2 chain/helpers (fitted courier skins only). */
  readonly bones: CourierBones | undefined;
  private readonly sampledPose: { node: Object3D; position: Vector3; rotation: Quaternion }[] = [];
  constructor(private readonly rig: CharacterRig, clipSource?: typeof skinClips) {
    this.skin = clipSource === skinClips;
    this.bones = this.skin ? courierBones(rig.root) : undefined;
    if (this.skin) for (const node of [...Object.values(rig), ...this.bones ? chainNodes(this.bones) : []]) this.sampledPose.push({ node, position: node.position.clone(), rotation: node.quaternion.clone() });
    if (this.skin) this.ground = new CourierGroundContacts(rig);
    this.strides = clipSource === skinClips ? { ...strides, ...Object.fromEntries(Object.entries(skinGait).map(([k, g]) => [k, g.stride])) } : strides;
    this.mixer = new AnimationMixer(rig.root);
    this.backpack = rig.root.getObjectByName('backpackSocket'); this.backpackRest = this.backpack?.rotation.z ?? 0;
    for (const name of authoredClips.keys()) {
      if (name.startsWith('corgi-') || name === 'infected-flight' || name === 'animal-death') continue;
      this.actions.set(name, this.mixer.clipAction(retargetClip(rig.root, name, false, clipSource)));
      if (/^(unarmed-|fists-|bat-|crowbar-|machete-|swing|shoot|throw)/.test(name)) {
        const clip = retargetClip(rig.root, name, true, clipSource); clip.blendMode = AdditiveAnimationBlendMode;
        this.actions.set(`${name}:upper`, this.mixer.clipAction(clip));
      }
    }
    const carry = retargetClip(rig.root, 'carry', false, clipSource);
    for (const node of ['armL', 'armR', 'foreArmL', 'foreArmR', 'handL', 'handR'] as const) {
      const track = carry.tracks.find(t => t.name === `${node}.quaternion`);
      if (track) this.carryPose.push([rig[node], new Quaternion().fromArray(track.values, 0)]);
    }
  }
  private play(name: string, loop = true): AnimationAction {
    const action = this.actions.get(name);
    if (!action) { this.missingClips++; throw new Error(`Missing character clip ${name}`); }
    action.reset().setEffectiveWeight(1).setEffectiveTimeScale(1).setLoop(loop ? LoopRepeat : LoopOnce, loop ? Infinity : 1); action.clampWhenFinished = !loop; action.play(); return action;
  }
  update(pose: SurvivorState, tick: number, alpha = 1, turn = 0, ride?: RidePose): void {
    const time = (tick + alpha - 1) / 60, dt = Math.max(0, time - this.lastTime); this.lastTime = time;
    if (dt === 0 && this.evaluations > 0) return;
    this.state = pose.animation;
    // The view parent follows the collision-resolved, interpolated sim position.
    const position = this.rig.root.parent ? this.rig.root.getWorldPosition(this.worldPosition) : undefined;
    let traveled: number | undefined;
    if (position) {
      if (this.lastPosition && dt > 0) traveled = Math.hypot(position.x - this.lastPosition.x, position.z - this.lastPosition.z);
      this.lastPosition = { x: position.x, z: position.z };
    }
    const speed = traveled !== undefined && dt > 0 ? (traveled > 3 ? 0 : traveled / dt) : Math.hypot(pose.velocity.x, pose.velocity.z);
    let name = speed > 2.5 ? 'run' : speed > (this.moving ? .06 : .16) ? 'walk' : 'idle';
    const moving = name !== 'idle';
    if (moving !== this.moving) {
      this.moving = moving; this.transitionUntil = time + (moving ? .18 : .22); name = moving ? 'start' : 'stop';
      // Fitted courier: start mid-stance so the first step is a real step (one foot swings at once, the other releases within reach).
      if (moving && this.skin) this.phase = .26;
    }
    else if (time < this.transitionUntil) name = this.clip === 'start' ? 'start' : 'stop';
    if (!moving && turn) name = turn > 0 ? 'turn-left' : 'turn-right';
    const combat = pose.attack;
    let strike: string | undefined;
    if (['swing','kick','shoot','throw'].includes(pose.animation)) {
      const weapon = combat?.actionId.replace('weapon.', '') ?? 'swing';
      const combo = combat?.combo ?? 0, unarmed = `unarmed-${meleeChains['weapon.fists'][combo] ?? 'jab'}`;
      strike = weapon === 'fists' ? this.actions.has(unarmed) ? unarmed : `fists-${combo % 3 + 1}` : pose.animation === 'kick' ? combo === 1 ? 'spin-kick' : 'kick' : ['bat','crowbar','machete'].includes(weapon) ? `${weapon}-${combo + 1}` : pose.animation;
    }
    const upper = strike && moving && pose.animation !== 'kick' && !/kick|knee/.test(strike);
    if (strike && !upper) name = strike;
    else if (!strike && !['idle','walk','run'].includes(pose.animation)) name = pose.animation;
    // E19 courier: seated pedalling while riding (mount/dismount play as actions).
    else if (ride) name = 'ride';
    if (this.skin) {
      if (!!ride !== this.riding) { this.riding = !!ride; this.rideChangedAt = time; }
      const progress = smooth(0, .4, time - this.rideChangedAt);
      this.rideWeight = this.riding ? progress : this.rideChangedAt < 0 ? 0 : 1 - progress;
      if (this.rideChangedAt >= 0 && time - this.rideChangedAt < .4 && !strike && pose.animation !== 'die' && pose.animation !== 'hurt') name = this.riding ? 'mount' : 'dismount';
    }
    // PO #2/#4 (puppet walk, flicker): locomotion is a speed blend-space (idle / walk / run weighted by a
    // smoothed ground speed, all on one stride-matched phase), never discrete clip restarts; start/stop/turn
    // pops are gone. Other actions fade over it.
    const loco = locoStates.has(name), fade = strike ? Math.min(.05, Math.max(1, (combat?.activeAt ?? tick + 4) - (combat?.started ?? tick)) / 60 * .55) : name === 'hurt' ? .055 : .2;
    this.locoSpeed += (speed - this.locoSpeed) * (1 - Math.exp(-dt / .1));
    if (!loco && (this.mode !== name || strike && !upper && this.attackTick !== pose.animationTick || name === 'hurt' && this.actionTick !== pose.animationTick || !this.base)) {
      this.base?.fadeOut(fade); this.base = this.play(name, !!this.strides[name] || name === 'idle').fadeIn(fade);
      this.mode = name; this.clip = name; this.actionTick = pose.animationTick;
    } else if (loco && this.mode !== 'loco') { this.base?.fadeOut(.2); this.base = undefined; this.mode = 'loco'; }
    this.locoWeight = Math.max(0, Math.min(1, this.locoWeight + (loco ? 1 : -1) * dt / (loco ? .2 : fade)));
    let groundStride = 0, groundRun = 0;
    {
      const s = this.locoSpeed, move = smooth(.04, .55, s), run = smooth(1.9, 3.3, s);
      // PO 27 (walk micro-vibration): stride-matching the short chibi legs gave 9 steps/s walking and up to 15 steps/s
      // running, which reads as the figure vibrating. Cadence is capped (rigid walk/run 2.0/2.7, fitted skin 2.9/2.9 cycles/s);
      // above that the stride lengthens instead (small slide at the game camera beats a buzzing gait).
      const stride = Math.max((this.strides.walk + (this.strides.run - this.strides.walk) * run) * strideScale(this.rig.root), s / (this.skin ? 2.9 : 2 + .7 * run));
      groundStride = stride; groundRun = run;
      if (s > .01) this.phase = (this.phase + (this.skin ? speed : s) * dt / stride) % 1;
      const weights: [string, number][] = [['idle', 1 - move], ['walk', move * (1 - run)], ['run', move * run]];
      for (const [clip, w] of weights) {
        const action = this.actions.get(clip)!;
        if (!action.isRunning()) action.reset().setLoop(LoopRepeat, Infinity).play();
        action.enabled = true; action.stopFading();
        if (clip !== 'idle') { action.time = this.phase * action.getClip().duration; action.setEffectiveTimeScale(0); } else action.setEffectiveTimeScale(1);
        action.setEffectiveWeight(w * this.locoWeight);
      }
      if (loco) this.clip = weights.reduce((a, b) => b[1] > a[1] ? b : a)[0];
    }
    if (name === 'ride' && this.base && ride) {
      // Pedalling follows the bike's crank; no stride accumulation while seated.
      this.base.time = ((ride.pedal / (Math.PI * 2)) % 1 + 1) % 1 * this.base.getClip().duration; this.base.setEffectiveTimeScale(0);
    }
    if (upper && strike && this.attackTick !== pose.animationTick) { this.overlay?.fadeOut(.12); this.overlay = this.play(`${strike}:upper`, false).fadeIn(.05); }
    else if (!upper && this.overlay) { this.overlay.fadeOut(.12); this.overlay = undefined; }
    // Authored contact sits at 20 % of every strike clip: warp anticipation onto the
    // sim windup and follow-through onto recovery, so the hit lands on the damage tick.
    const struck = strike && combat ? upper ? this.overlay : this.base : undefined;
    if (struck && combat) {
      // Render time trails the sim by one tick (alpha interpolation); land contact on the frame that
      // shows the damage tick, so the hit-stop freezes the contact pose rather than the coil.
      const u = tick + alpha - 1 - combat.started, a = Math.max(1, combat.activeAt - combat.started - 1), e = Math.max(a + 1, combat.endsAt - combat.started - 1);
      const phase = u < a ? .2 * Math.max(0, u) / a : Math.min(1, .2 + .8 * (u - a) / (e - a));
      struck.time = phase * struck.getClip().duration; struck.setEffectiveTimeScale(0);
      // Lunge step into the target (research §5: attacker step 0.10–0.25 m) so strikes read at the
      // game camera: in over the anticipation, held through contact, eased back in recovery.
      this.lunge = phase < .2 ? phase / .2 : phase < .4 ? 1 : Math.max(0, 1 - (phase - .4) / .5);
    } else this.lunge = 0;
    this.attackTick = strike ? pose.animationTick : -1;
    // Restore every mixer input before sampling: Three skips unchanged bindings,
    // while our contacts, carry and bicycle layers modify those same nodes.
    for (const p of this.sampledPose) { p.node.position.copy(p.position); p.node.quaternion.copy(p.rotation); }
    this.mixer.update(dt);
    for (const p of this.sampledPose) { p.position.copy(p.node.position); p.rotation.copy(p.node.quaternion); }
    if (this.skin && name !== 'die') this.keepTorsoForward();
    const plantedAction = !ride && (name === 'hurt' || !!strike && !/kick|knee|spinning/.test(strike));
    if (this.skin && this.lunge > 0 && !upper) {
      const scale = (this.rig.hip.parent ?? this.rig.root).getWorldScale(this.scaleScratch).y || 1;
      this.rig.hip.position.x += .09 / scale * this.lunge * this.lunge * (3 - 2 * this.lunge);
    }
    if (this.ground) {
      const grounded = (loco || plantedAction) && !ride;
      this.contactWeight = Math.max(0, Math.min(1, this.contactWeight + (grounded ? 1 : -1) * dt / .1));
      if (grounded) this.ground.update(this.phase, groundStride, groundRun, this.contactWeight, speed, dt);
      else this.ground.reset();
    }
    // Parcel carry: arms hold the box over any lower-body motion, eased in/out over 150 ms.
    const holding = !!pose.carrying && !strike && name !== 'hand-over' && name !== 'ride';
    this.carryWeight = Math.max(0, Math.min(1, this.carryWeight + (holding ? 1 : -1) * dt / .15));
    if (this.carryWeight > 0) for (const [node, target] of this.carryPose) node.quaternion.slerp(target, this.carryWeight);
    if (!this.skin && this.lunge > 0 && !upper) { const scale = (this.rig.hip.parent ?? this.rig.root).getWorldScale(this.scaleScratch).y || 1; const offset = .14 / scale * this.lunge * this.lunge * (3 - 2 * this.lunge); this.rig.hip.position.x += offset; }
    for (const node of Object.values(this.rig)) node.quaternion.normalize();
    if (pose.animation === 'die') settleGroundPose(this.rig.root);
    // Skeleton v2 swings the bag with a 2-DOF pendulum after the ride contacts (CourierLiving).
    if (!this.bones) {
      const target = this.rig.torso.rotation.z * -.3;
      const springDt = Math.min(.03, dt);
      this.secondaryVelocity += ((target - this.secondary) * 90 - this.secondaryVelocity * 15) * springDt; this.secondary += this.secondaryVelocity * springDt;
      if (this.backpack) this.backpack.rotation.z = this.backpackRest + this.secondary;
    }
    this.evaluations++;
  }
  /** A forward support line also survives action fades and hit recoil. Source
   * twist and roll remain; only backward pitch is softly limited. Use the
   * anatomical shoulders rather than an Euler angle or a camera projection. */
  private keepTorsoForward(): void {
    const r = this.rig;
    this.postureRotation.copy(r.hip.quaternion).multiply(r.torso.quaternion);
    shoulderOffset(r, this.bones, this.chest).applyQuaternion(this.postureRotation);
    this.spine.copy(r.torso.position).applyQuaternion(r.hip.quaternion);
    const pitch = Math.atan2(this.chest.x + this.spine.x, this.chest.y + this.spine.y);
    if (pitch >= .12) return;
    const target = .015 + .025 * Math.log1p(Math.exp((pitch - .015) / .025));
    const angle = Math.atan2(this.chest.x, this.chest.y) - target + Math.asin(Math.max(-1, Math.min(1,
      (this.spine.x * Math.cos(target) - this.spine.y * Math.sin(target)) / Math.hypot(this.chest.x, this.chest.y))));
    this.postureAxis.set(0, 0, 1).applyQuaternion(this.postureRotation.copy(r.hip.quaternion).invert());
    r.torso.quaternion.premultiply(this.postureRotation.setFromAxisAngle(this.postureAxis, angle));
  }
}
