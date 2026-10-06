import { AdditiveAnimationBlendMode, AnimationMixer, LoopOnce, LoopRepeat, type AnimationAction, type Object3D } from 'three';
import type { AnimationState, SurvivorState } from '../../data/survivor';
import { authoredClips, retargetClip, strides } from './clips';
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
      if (name.startsWith('corgi-')) continue;
      this.actions.set(name, this.mixer.clipAction(retargetClip(rig.root, name)));
      if (/^(fists-|bat-|crowbar-|machete-|swing|shoot|throw)/.test(name)) {
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
  update(pose: SurvivorState, tick: number, alpha = 1): void {
    const time = (tick + alpha - 1) / 60, dt = Math.max(0, Math.min(.1, time - this.lastTime)); this.lastTime = time;
    this.state = pose.animation;
    const speed = Math.hypot(pose.velocity.x, pose.velocity.z);
    let name = speed > 2.5 ? 'run' : speed > (this.moving ? .06 : .16) ? 'walk' : 'idle';
    const moving = name !== 'idle';
    if (moving !== this.moving) { this.moving = moving; this.transitionUntil = time + (moving ? .18 : .22); name = moving ? 'start' : 'stop'; }
    else if (time < this.transitionUntil) name = this.clip === 'start' ? 'start' : 'stop';
    const combat = pose.attack;
    let strike: string | undefined;
    if (['swing','kick','shoot','throw'].includes(pose.animation)) {
      const weapon = combat?.actionId.replace('weapon.', '') ?? 'swing';
      strike = pose.animation === 'kick' ? combat?.combo === 1 ? 'spin-kick' : 'kick' : ['fists','bat','crowbar','machete'].includes(weapon) ? `${weapon}-${(combat?.combo ?? 0) + 1}` : pose.animation;
    }
    const upper = strike && moving && pose.animation !== 'kick';
    if (strike && !upper) name = strike;
    else if (!strike && !['idle','walk','run'].includes(pose.animation)) name = pose.animation;
    if (this.clip !== name || strike && !upper && this.attackTick !== pose.animationTick || !this.base) {
      const previous = this.base; this.base = this.play(name, !!strides[name] || name === 'idle');
      if (previous && previous !== this.base) previous.crossFadeTo(this.base, .14, false);
      this.clip = name;
    }
    if (strides[name] && this.base) this.base.setEffectiveTimeScale(speed * this.base.getClip().duration / strides[name]);
    if (strike && combat && this.base && !upper) this.base.setEffectiveTimeScale(this.base.getClip().duration * 60 / Math.max(1, combat.endsAt - combat.started));
    if (upper && strike && this.attackTick !== pose.animationTick) {
      this.overlay?.fadeOut(.12); this.overlay = this.play(`${strike}:upper`, false).fadeIn(.1);
      if (combat) this.overlay.setEffectiveTimeScale(this.overlay.getClip().duration * 60 / Math.max(1, combat.endsAt - combat.started));
    } else if (!upper && this.overlay) { this.overlay.fadeOut(.12); this.overlay = undefined; }
    this.attackTick = strike ? pose.animationTick : -1;
    this.mixer.update(dt);
    const target = this.rig.torso.rotation.z * -.3;
    this.secondaryVelocity += ((target - this.secondary) * 90 - this.secondaryVelocity * 15) * dt; this.secondary += this.secondaryVelocity * dt;
    if (this.backpack) this.backpack.rotation.z = this.backpackRest + this.secondary;
    this.evaluations++;
  }
}
