import { AnimationMixer, LoopOnce, type AnimationAction, type Object3D } from 'three';
import { cadenceStride, retargetClip, settleGroundPose, strideScale, strides } from './clips';
import { GroundContacts } from './GroundContacts';
import { GaitPhase } from './GaitPhase';
import type { CharacterRig } from './rig';
/** Escort figures use the same distance clock and fades as instanced civilians. */
export class NpcAnimator {
  private readonly mixer: AnimationMixer;
  private readonly actions = new Map<string, AnimationAction>();
  private current?: AnimationAction;
  private clip = '';
  private time = 0;
  private readonly phase = new GaitPhase();
  private readonly ground: GroundContacts;
  constructor(private readonly root: Object3D) {
    this.mixer = new AnimationMixer(root);
    const rig = Object.fromEntries(['hip', 'legL', 'legR', 'shinL', 'shinR', 'footL', 'footR'].map(name => [name, root.getObjectByName(name)!])) as CharacterRig;
    rig.root = root; this.ground = new GroundContacts(rig);
    for (const name of ['idle', 'npc-walk', 'run', 'death-side']) this.actions.set(name, this.mixer.clipAction(retargetClip(root, name)));
  }
  update(time: number, speed: number, distance: number, down: boolean): void {
    const name = down ? 'death-side' : speed > (this.clip === 'run' ? 2.2 : 2.5) ? 'run' : speed > (this.clip === 'npc-walk' ? .04 : .12) ? 'npc-walk' : 'idle';
    if (name !== this.clip) {
      const previous = this.current; this.current = this.actions.get(name)!.reset().setEffectiveWeight(1).play();
      if (down) { this.current.setLoop(LoopOnce, 1); this.current.clampWhenFinished = true; }
      previous?.crossFadeTo(this.current, .2, false); this.clip = name;
    }
    const phase = this.phase.sample(0, distance, name, strideScale(this.root), speed);
    if (strides[name]) { for (const [clip, action] of this.actions) if (strides[clip]) {
      action.time = phase * action.getClip().duration; action.setEffectiveTimeScale(0);
    }
    } else if (down && this.current) { this.current.time = this.current.getClip().duration; this.current.setEffectiveTimeScale(0); }
    else this.current?.setEffectiveTimeScale(1);
    this.ground.restore(); this.mixer.update(Math.max(0, time - this.time)); this.time = time;
    if (strides[name]) this.ground.update(phase, cadenceStride(name, strideScale(this.root), speed), name === 'run' ? 1 : 0, 1); else this.ground.reset();
    if (down) settleGroundPose(this.root);
  }
}
