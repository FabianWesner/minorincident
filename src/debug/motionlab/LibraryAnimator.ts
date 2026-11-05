import { AnimationMixer, type AnimationAction, type AnimationClip, type Object3D } from 'three';
import type { SurvivorState } from '../../data/survivor';
/** Mesh2Motion CC0 locomotion clips, evaluated on the explicit lab clock. */
export class LibraryAnimator {
  readonly mixer: AnimationMixer;
  clip = 'Idle_A';
  private base?: AnimationAction;
  private readonly actions = new Map<string, AnimationAction>();
  private phase = 0;
  constructor(root: Object3D, clips: AnimationClip[], private readonly stride: number) {
    this.mixer = new AnimationMixer(root); for (const clip of clips) this.actions.set(clip.name, this.mixer.clipAction(clip));
  }
  update(pose: SurvivorState): void {
    const speed = Math.hypot(pose.velocity.x, pose.velocity.z), name = speed > 2.5 ? 'Jog' : speed > .06 ? 'Walk' : 'Idle_A';
    if (!this.base || this.clip !== name) {
      const previous = this.base; this.base = this.actions.get(name)!.reset().setEffectiveWeight(1).play(); previous?.crossFadeTo(this.base, .16, false); this.clip = name;
    }
    if (name !== 'Idle_A') {
      this.phase = (this.phase + speed / 60 / this.stride) % 1;
      for (const [name, action] of this.actions) if (name !== 'Idle_A') { action.time = this.phase * action.getClip().duration; action.setEffectiveTimeScale(0); }
    }
    this.mixer.update(1 / 60);
  }
}
