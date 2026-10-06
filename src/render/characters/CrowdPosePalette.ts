import { clipTexture, type CrowdClip } from '../../assets/crowd';

/** Freeze the last displayed pose when a clip changes, including interrupted fades.
 * Extra atlas rows keep animation transitions in the existing single crowd draw. */
export class CrowdPosePalette {
  readonly texture;
  private readonly rows: Float32Array;
  private readonly width: number;
  private readonly states = new Map<number, { clip: string; frame: number; row: number; weight: number; started: number; seen: number }>();
  constructor(readonly clip: CrowdClip, private readonly capacity: number, readonly seconds = .2) {
    this.width = clip.parts.length * 16;
    this.rows = new Float32Array((clip.frames + capacity) * this.width);
    this.rows.set(clip.matrices);
    this.texture = clipTexture({ ...clip, frames: clip.frames + capacity, matrices: this.rows });
  }
  sample(id: number, clip: string, frame: number, time: number): [number, number] {
    let state = this.states.get(id);
    if (state && (time < state.seen || time - state.seen > .5)) { this.states.delete(id); state = undefined; }
    if (!state) {
      if (this.states.size >= this.capacity) {
        const oldest = [...this.states].sort((a, b) => a[1].seen - b[1].seen)[0];
        this.states.delete(oldest[0]);
      }
      const used = new Set([...this.states.values()].map(s => s.row));
      let row = this.clip.frames;
      while (used.has(row)) row++;
      for (let i = 0; i < this.width; i++) this.rows[row * this.width + i] = this.component(frame, i);
      (this.texture.image.data as Float32Array).set(this.rows.subarray(row * this.width, (row + 1) * this.width), row * this.width);
      this.texture.needsUpdate = true;
      state = { clip, frame, row, weight: 1, started: time - this.seconds, seen: time };
      this.states.set(id, state);
    } else if (state.clip !== clip) {
      const offset = state.row * this.width;
      for (let i = 0; i < this.width; i++) this.rows[offset + i] = this.component(state.frame, i) * state.weight + this.rows[offset + i] * (1 - state.weight);
      // clipTexture owns its upload buffer; update only on clip changes.
      (this.texture.image.data as Float32Array).set(this.rows.subarray(offset, offset + this.width), offset);
      this.texture.needsUpdate = true;
      state.clip = clip; state.started = time; state.weight = 0;
    } else state.weight = Math.min(1, Math.max(0, (time - state.started) / this.seconds));
    state.frame = frame; state.seen = time;
    return [state.row, state.weight];
  }
  private component(frame: number, component: number): number {
    const low = Math.floor(frame), alpha = frame - low;
    return this.rows[low * this.width + component] * (1 - alpha) + this.rows[Math.ceil(frame) * this.width + component] * alpha;
  }
  /** CPU counterpart of the shader for regression probes. */
  pose(frame: number, outgoing: number, weight: number): Float32Array {
    const result = new Float32Array(this.width);
    for (let i = 0; i < this.width; i++) result[i] = this.component(frame, i) * weight + this.rows[outgoing * this.width + i] * (1 - weight);
    return result;
  }
}
