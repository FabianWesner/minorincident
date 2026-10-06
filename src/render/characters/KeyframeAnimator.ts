import { AdditiveAnimationBlendMode, AnimationMixer, LoopOnce, LoopRepeat, Vector3, type AnimationAction, type Object3D } from 'three';
import { meleeChains } from '../../data/meleeCombos';
import type { AnimationState, SurvivorState } from '../../data/survivor';
import { authoredClips, retargetClip, settleGroundPose, strides, strideScale } from './clips';
import type { CharacterRig } from './rig';

/** Authored glTF actions, 140 ms crossfades, speed-matched strides and upper-body layers.
 * The explicit sim clock supports paused stepping and visual hit-stop. */
export class KeyframeAnimator {
  readonly mixer: AnimationMixer;
  private readonly actions = new Map<string, AnimationAction>();
  private base: AnimationAction | undefined;
  private overlay: AnimationAction | undefined;
  private attackTick = -1;
  private lastTime = 0;
  private moving = false;
  private phase = 0;
  private readonly worldPosition = new Vector3();
  private lastPosition: { x: number; z: number } | undefined;
  private transitionUntil = 0;
  private secondary = 0;
  private secondaryVelocity = 0;
  private readonly backpack: Object3D | undefined;
  private readonly backpackRest: number;
  state: AnimationState = 'idle';
  clip = 'idle';
  evaluations = 0;
  missingClips = 0;
  constructor(private readonly rig: CharacterRig) {
    this.mixer = new AnimationMixer(rig.root);
    this.backpack = rig.root.getObjectByName('backpackSocket'); this.backpackRest = this.backpack?.rotation.z ?? 0;
    for (const name of authoredClips.keys()) {
      if (name.startsWith('corgi-') || name === 'infected-flight' || name === 'animal-death') continue;
      this.actions.set(name, this.mixer.clipAction(retargetClip(rig.root, name)));
      if (/^(unarmed-|fists-|bat-|crowbar-|machete-|swing|shoot|throw)/.test(name)) {
        const clip = retargetClip(rig.root, name, true); clip.blendMode = AdditiveAnimationBlendMode;
        this.actions.set(`${name}:upper`, this.mixer.clipAction(clip));
      }
    }
  }
  private play(name: string, loop = true): AnimationAction {
    const action = this.actions.get(name);
    if (!action) { this.missingClips++; throw new Error(`Missing character clip ${name}`); }
    action.reset().setEffectiveWeight(1).setEffectiveTimeScale(1).setLoop(loop ? LoopRepeat : LoopOnce, loop ? Infinity : 1); action.clampWhenFinished = !loop; action.play(); return action;
  }
  update(pose: SurvivorState, tick: number, alpha = 1, turn = 0): void {
    const time = (tick + alpha - 1) / 60, dt = Math.max(0, time - this.lastTime); this.lastTime = time;
    if (dt === 0 && this.base) return;
    this.state = pose.animation;
    // The view parent follows the collision-resolved, interpolated sim position.
    const position = this.rig.root.parent ? this.rig.root.getWorldPosition(this.worldPosition) : undefined;
    let traveled: number | undefined;
    if (position) {
      if (this.lastPosition && dt > 0) traveled = Math.hypot(position.x - this.lastPosition.x, position.z - this.lastPosition.z);
      this.lastPosition = { x: position.x, z: position.z };
    }
    const speed = pose.animation === 'idle' ? 0 : traveled !== undefined && dt > 0 ? (traveled > 3 ? 0 : traveled / dt) : Math.hypot(pose.velocity.x, pose.velocity.z);
    let name = speed > 2.5 ? 'run' : speed > (this.moving ? .06 : .16) ? 'walk' : 'idle';
    const moving = name !== 'idle';
    if (moving !== this.moving) { this.moving = moving; this.transitionUntil = time + (moving ? .18 : .22); name = moving ? 'start' : 'stop'; }
    else if (time < this.transitionUntil) name = this.clip === 'start' ? 'start' : 'stop';
    if (!moving && turn) name = turn > 0 ? 'turn-left' : 'turn-right';
    const combat = pose.attack;
    let strike: string | undefined;
    if (['swing','kick','shoot','throw'].includes(pose.animation)) {
      const weapon = combat?.actionId.replace('weapon.', '') ?? 'swing';
      strike = weapon === 'fists' ? `unarmed-${meleeChains['weapon.fists'][combat?.combo ?? 0]}` : pose.animation === 'kick' ? combat?.combo === 1 ? 'spin-kick' : 'kick' : ['fists','bat','crowbar','machete'].includes(weapon) ? `${weapon}-${(combat?.combo ?? 0) + 1}` : pose.animation;
    }
    const upper = strike && moving && pose.animation !== 'kick' && !(combat?.actionId === 'weapon.fists' && [2,3,5].includes(combat.combo));
    if (strike && !upper) name = strike;
    else if (!strike && !['idle','walk','run'].includes(pose.animation)) name = pose.animation;
    if (this.clip !== name || strike && !upper && this.attackTick !== pose.animationTick || !this.base) {
      const previous = this.base; this.base = this.play(name, !!strides[name] || name === 'idle');
      if (previous && previous !== this.base) previous.crossFadeTo(this.base, .14, false);
      this.clip = name;
    }
    if (strides[name] && this.base) {
      this.phase = (this.phase + speed * dt / (strides[name] * strideScale(this.rig.root))) % 1;
      // Keep the outgoing gait on the same support phase throughout crossfade.
      for (const [clip, action] of this.actions) if (strides[clip]) {
        action.time = this.phase * action.getClip().duration; action.setEffectiveTimeScale(0);
      }
    }
    if (strike && combat && this.base && !upper) this.base.setEffectiveTimeScale(this.base.getClip().duration * 60 / Math.max(1, combat.endsAt - combat.started));
    if (upper && strike && this.attackTick !== pose.animationTick) {
      this.overlay?.fadeOut(.12); this.overlay = this.play(`${strike}:upper`, false).fadeIn(.1);
      if (combat) this.overlay.setEffectiveTimeScale(this.overlay.getClip().duration * 60 / Math.max(1, combat.endsAt - combat.started));
    } else if (!upper && this.overlay) { this.overlay.fadeOut(.12); this.overlay = undefined; }
    this.attackTick = strike ? pose.animationTick : -1;
    this.mixer.update(dt);
    for (const node of Object.values(this.rig)) node.quaternion.normalize();
    if (pose.animation === 'die') settleGroundPose(this.rig.root);
    const target = this.rig.torso.rotation.z * -.3;
    const springDt = Math.min(.03, dt);
    this.secondaryVelocity += ((target - this.secondary) * 90 - this.secondaryVelocity * 15) * springDt; this.secondary += this.secondaryVelocity * springDt;
    if (this.backpack) this.backpack.rotation.z = this.backpackRest + this.secondary;
    this.evaluations++;
  }
}
