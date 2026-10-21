import { clipTexture, type CrowdClip } from '../../assets/crowd';
import { Matrix4, Quaternion, Vector3 } from 'three';

/** Freeze the last displayed pose when a clip changes, including interrupted fades.
 * Extra atlas rows keep animation transitions in the existing single crowd draw. */
export class CrowdPosePalette {
  readonly texture;
  private readonly rows: Float32Array;
  private readonly width: number;
  private readonly currentMatrix = new Matrix4();
  private readonly previousMatrix = new Matrix4();
  private readonly position = new Vector3();
  private readonly previousPosition = new Vector3();
  private readonly rotation = new Quaternion();
  private readonly previousRotation = new Quaternion();
  private readonly scale = new Vector3();
  private readonly previousScale = new Vector3();
  private readonly states = new Map<number, { clip: string; frame: number; row: number; weight: number; started: number; seen: number }>();
  constructor(readonly clip: CrowdClip, private readonly capacity: number, readonly seconds = .2) {
    this.width = clip.parts.length * 16;
    this.rows = new Float32Array((clip.frames + capacity * 2) * this.width);
    this.rows.set(clip.matrices);
    this.texture = clipTexture({ ...clip, frames: clip.frames + capacity * 2, matrices: this.rows });
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
      this.copyFrame(frame, row * this.width);
      (this.texture.image.data as Float32Array).set(this.rows.subarray(row * this.width, (row + 1) * this.width), row * this.width);
      this.dirty(row);
      state = { clip, frame, row, weight: 1, started: time - this.seconds, seen: time };
      this.states.set(id, state);
    } else if (state.clip !== clip) {
      const offset = state.row * this.width;
      const low = Math.floor(state.frame), alpha = state.frame - low, from = low * this.width, to = Math.ceil(state.frame) * this.width;
      for (let i = 0; i < this.width; i++) this.rows[offset + i] = (this.rows[from + i] * (1 - alpha) + this.rows[to + i] * alpha) * state.weight + this.rows[offset + i] * (1 - state.weight);
      // clipTexture owns its upload buffer; update only on clip changes.
      (this.texture.image.data as Float32Array).set(this.rows.subarray(offset, offset + this.width), offset);
      this.dirty(state.row);
      state.clip = clip; state.started = time; state.weight = 0;
    } else state.weight = Math.min(1, Math.max(0, (time - state.started) / this.seconds));
    state.frame = frame; state.seen = time;
    return [state.row, state.weight];
  }
  /** Frame bounds are shared by every component in a pose row. */
  private copyFrame(frame: number, offset: number): void {
    const low = Math.floor(frame), alpha = frame - low, from = low * this.width, to = Math.ceil(frame) * this.width;
    // A second layer (weapon/hand pose) often corrects the row just written by
    // locomotion. Integer rows already contain the exact float32 pose.
    if (alpha === 0) {
      if (from !== offset) this.rows.copyWithin(offset, from, from + this.width);
      return;
    }
    for (let i = 0; i < this.width; i++) this.rows[offset + i] = this.rows[from + i] * (1 - alpha) + this.rows[to + i] * alpha;
  }
  private component(frame: number, component: number): number {
    const low = Math.floor(frame), alpha = frame - low;
    return this.rows[low * this.width + component] * (1 - alpha) + this.rows[Math.ceil(frame) * this.width + component] * alpha;
  }
  /** Keep the last displayed pose authoritative while a phone figure holds its world transform. */
  reuse(id: number, frame: number): void { const state = this.states.get(id)!; state.frame = frame; state.weight = 1; }
  /** Per-instance contact correction in the same GPU draw. Settled poses keep
   * using the immutable atlas; only moving figures upload a corrected row. */
  correct(id: number, frame: number, outgoing: number, weight: number, correct: (pose: Float32Array) => void): number {
    const row = this.states.get(id)!.row + this.capacity;
    const pose = this.rows.subarray(row * this.width, (row + 1) * this.width);
    this.copyFrame(frame, row * this.width);
    if (weight < 1) for (let i = 0; i < this.width; i += 16) {
      // Matrix lerp collapses a part at opposing rotations. Blend TRS so an
      // interrupted turn/fall never shrinks a figure to zero between clips.
      this.currentMatrix.fromArray(pose, i).decompose(this.position, this.rotation, this.scale);
      this.previousMatrix.fromArray(this.rows, outgoing * this.width + i).decompose(this.previousPosition, this.previousRotation, this.previousScale);
      this.position.lerp(this.previousPosition, 1 - weight); this.rotation.slerp(this.previousRotation, 1 - weight); this.scale.lerp(this.previousScale, 1 - weight);
      this.currentMatrix.compose(this.position, this.rotation, this.scale).toArray(pose, i);
    }
    correct(pose); this.dirty(row);
    this.states.get(id)!.frame = row; this.states.get(id)!.weight = 1;
    return row;
  }
  /** Only mutable pose rows change; the baked atlas stays resident on both backends. */
  private dirty(row: number): void {
    this.texture.addUpdateRange(row * this.width, this.width);
    this.texture.needsUpdate = true;
  }
  /** True when every matrix component of atlas row `row` is finite. */
  finite(row: number): boolean {
    for (let i = row * this.width, end = i + this.width; i < end; i++) if (!Number.isFinite(this.rows[i])) return false;
    return true;
  }
  /** One rig part's matrix of a drawn pose (click picking); same blend as pose(). */
  part(frame: number, outgoing: number, weight: number, part: number, out: Matrix4): Matrix4 {
    const e = out.elements, base = part * 16;
    const low = Math.floor(frame), alpha = frame - low, from = low * this.width + base, to = Math.ceil(frame) * this.width + base;
    for (let i = 0; i < 16; i++) e[i] = (this.rows[from + i] * (1 - alpha) + this.rows[to + i] * alpha) * weight + this.rows[outgoing * this.width + base + i] * (1 - weight);
    return out;
  }
  /** CPU counterpart of the shader for regression probes. */
  pose(frame: number, outgoing: number, weight: number): Float32Array {
    const result = new Float32Array(this.width);
    for (let i = 0; i < this.width; i++) result[i] = this.component(frame, i) * weight + this.rows[outgoing * this.width + i] * (1 - weight);
    return result;
  }
}
