import { characterNodes, type AnimationState, type SurvivorState } from '../../data/survivor';
import { clips } from './clips';
import type { CharacterRig } from './rig';

/** Rest transforms are captured once. Evaluation reuses joints and allocates nothing each frame. */
export class ProceduralAnimator {
  private readonly rest;
  state: AnimationState = 'idle';
  evaluations = 0;
  missingClips = 0;
  constructor(private readonly rig: CharacterRig) {
    this.rest = characterNodes.map((name) => ({ node: rig[name], position: rig[name].position.clone(), rotation: rig[name].rotation.clone() }));
  }
  update(pose: SurvivorState, tick: number, alpha = 1): void {
    for (const rest of this.rest) { rest.node.position.copy(rest.position); rest.node.rotation.copy(rest.rotation); }
    this.state = pose.animation;
    const clip = clips[this.state];
    if (!clip) { this.missingClips++; throw new Error(`Missing character clip ${this.state}`); }
    clip(this.rig, Math.max(0, tick - pose.animationTick + alpha - 1) / 60); this.evaluations++;
  }
}
