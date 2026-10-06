import { AnimationMixer, LoopOnce, type AnimationAction, type Object3D } from 'three';
import { retargetClip, settleGroundPose, strideScale, strides } from './clips';
/** Escort figures use the same distance clock and fades as instanced civilians. */
export class NpcAnimator {
  private readonly mixer: AnimationMixer;
  private readonly actions = new Map<string, AnimationAction>();
  private current?: AnimationAction;
  private clip = '';
  private time = 0;
  constructor(private readonly root: Object3D) {
    this.mixer = new AnimationMixer(root);
    for (const name of ['idle', 'npc-walk', 'run', 'death-side']) this.actions.set(name, this.mixer.clipAction(retargetClip(root, name)));
  }
  update(time: number, speed: number, distance: number, down: boolean): void {
    const name = down ? 'death-side' : speed > (this.clip === 'run' ? 2.2 : 2.5) ? 'run' : speed > (this.clip === 'npc-walk' ? .04 : .12) ? 'npc-walk' : 'idle';
    if (name !== this.clip) {
      const previous = this.current; this.current = this.actions.get(name)!.reset().setEffectiveWeight(1).play();
      if (down) { this.current.setLoop(LoopOnce, 1); this.current.clampWhenFinished = true; }
      previous?.crossFadeTo(this.current, .2, false); this.clip = name;
    }
    if (strides[name]) { for (const [clip, action] of this.actions) if (strides[clip]) {
      action.time = distance / (strides[clip] * strideScale(this.root)) % 1 * action.getClip().duration; action.setEffectiveTimeScale(0);
    }
    } else if (down && this.current) { this.current.time = this.current.getClip().duration; this.current.setEffectiveTimeScale(0); }
    else this.current?.setEffectiveTimeScale(1);
    this.mixer.update(Math.max(0, time - this.time)); this.time = time;
    if (down) settleGroundPose(this.root);
  }
}
