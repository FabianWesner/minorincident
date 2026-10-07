import { cadenceStride } from './clips';

/** Integrate distance increments. Dividing lifetime distance by a changing stride
 * makes the pose jump whenever collision response changes speed. */
export class GaitPhase {
  private readonly states = new Map<number, { distance: number; phase: number }>();
  sample(id: number, distance: number, clip: string, scale: number, speed: number): number {
    let state = this.states.get(id);
    if (!state) { state = { distance, phase: (id * .137) % 1 }; this.states.set(id, state); }
    const delta = Math.max(0, distance - state.distance);
    state.phase = (state.phase + Math.min(delta, 3) / Math.max(.001, cadenceStride(clip, scale, speed))) % 1;
    state.distance = distance;
    return state.phase;
  }
}
