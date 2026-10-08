import { Quaternion, Vector3 } from 'three';
import type { Transform } from '../../sim/world/types';
const up = new Vector3(0, 1, 0);
/** Crowd figures turn at most this fast on screen (rad/s; the courier's presentation cap is 6). */
export const crowdTurnRate = 6;
const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));
/** Interpolate authoritative snapshots; never feed presentation back to AI.
 * `maxYawRate` (rad/s) limits the displayed turn speed: sim yaw snaps (face the target) become
 * turns the crowd footwork can step through instead of a body that spins over planted feet. */
export class MotionPresentation {
  private readonly states = new Map<number, { tick: number; from: Transform; to: Transform; yaw?: number; time?: number }>();
  private readonly from = new Quaternion();
  private readonly to = new Quaternion();
  private readonly result = { x: 0, y: 0, z: 0, yaw: 0 };
  constructor(private readonly maxYawRate = Infinity) {}
  sample(id: number, transform: Transform, tick: number, alpha = 1): Transform {
    let state = this.states.get(id);
    const edited = state && tick === state.tick && (transform.x !== state.to.x || transform.y !== state.to.y || transform.z !== state.to.z || transform.yaw !== state.to.yaw);
    if (!state || edited || tick < state.tick || Math.hypot(transform.x - state.to.x, transform.z - state.to.z) > 3) {
      state = { tick, from: { ...transform }, to: { ...transform }, yaw: edited ? state!.yaw : undefined, time: edited ? state!.time : undefined }; this.states.set(id, state);
    } else if (tick !== state.tick) { state.from = state.to; state.to = { ...transform }; state.tick = tick; }
    const t = Math.max(0, Math.min(1, alpha));
    this.from.setFromAxisAngle(up, state.from.yaw); this.to.setFromAxisAngle(up, state.to.yaw); this.from.slerp(this.to, t);
    this.result.x = state.from.x + (state.to.x - state.from.x) * t;
    this.result.y = state.from.y + (state.to.y - state.from.y) * t;
    this.result.z = state.from.z + (state.to.z - state.from.z) * t;
    this.result.yaw = Math.atan2(2 * this.from.w * this.from.y, 1 - 2 * this.from.y * this.from.y);
    if (this.maxYawRate < Infinity) {
      const time = (tick + t) / 60, dt = state.time === undefined ? Infinity : Math.max(0, Math.min(.1, time - state.time));
      if (state.yaw !== undefined && dt < Infinity) { const delta = wrap(this.result.yaw - state.yaw); this.result.yaw = wrap(state.yaw + Math.sign(delta) * Math.min(Math.abs(delta), this.maxYawRate * dt)); }
      state.yaw = this.result.yaw; state.time = time;
    }
    return this.result;
  }
}
