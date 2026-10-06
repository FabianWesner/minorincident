import { AnimationMixer, LoopOnce, type AnimationAction, type Object3D } from 'three';
import { retargetClip, strides } from './clips';

/** Authored four-beat walk and diagonal-pair trot, with calm idle/sit crossfades. */
export class QuadrupedAnimator {
  private readonly mixer: AnimationMixer;
  private readonly actions = new Map<string, AnimationAction>();
  private action: AnimationAction | undefined;
  private time = 0;
  private stoppedAt = 0;
  clip = 'corgi-idle';
  constructor(root: Object3D) {
    this.mixer = new AnimationMixer(root);
    for (const name of ['corgi-idle','corgi-walk','corgi-trot','corgi-sit']) this.actions.set(name, this.mixer.clipAction(retargetClip(root, name)));
  }
  update(time: number, speed: number, distance: number): void {
    const dt = Math.max(0, time - this.time); this.time = time;
    if (speed > .08) this.stoppedAt = time;
    const name = speed > (this.clip === 'corgi-trot' ? 1.2 : 1.6) ? 'corgi-trot' : speed > (this.clip === 'corgi-walk' ? .04 : .12) ? 'corgi-walk' : time - this.stoppedAt > 4 ? 'corgi-sit' : 'corgi-idle';
    if (!this.action || name !== this.clip) {
      const previous = this.action; this.action = this.actions.get(name)!.reset().setEffectiveWeight(1).play();
      if (name === 'corgi-sit') { this.action.setLoop(LoopOnce, 1); this.action.clampWhenFinished = true; }
      previous?.crossFadeTo(this.action, .16, false); this.clip = name;
    }
    if (strides[name]) { this.action.time = distance / strides[name] % 1 * this.action.getClip().duration; this.action.setEffectiveTimeScale(0); }
    else this.action.setEffectiveTimeScale(1);
    this.mixer.update(dt);
  }
}
