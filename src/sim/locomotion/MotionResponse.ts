import { FIXED_DT } from '../../core/Clock';

/** Plain fixed-step state: snapshots contain the response, not just its position. */
export interface MotionResponse {
  vx: number; vz: number; ax: number; az: number; omega: number; updatedAt: number;
}
export const motionLimits = { acceleration: 6, jerk: 48, turnSpeed: 4.5, angularAcceleration: 12 } as const;
export function motionResponse(): MotionResponse { return { vx: 0, vz: 0, ax: 0, az: 0, omega: 0, updatedAt: -1 }; }
export function resetResponse(state: MotionResponse): void { Object.assign(state, motionResponse()); }
export const angleDelta = (from: number, to: number) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
/** Critically damped velocity, with explicit acceleration and jerk bounds. */
/** The survivor's click-to-move: quicker than the crowds (run speed in ~0.5 s) while staying inside the
 * stage1 root jerk budget (≤ 50 m/s³ RMS, tests/unit/motionlab/stage1.test.ts). */
export const playerMotionLimits = { acceleration: 9, jerk: 80, omega: 8 } as const;
export function respond(state: MotionResponse, vx: number, vz: number, limits: { acceleration: number; jerk: number; omega?: number } = motionLimits): void {
  // Settle crisply: a stopping body under 3 cm/s with little acceleration left is at rest (no millimetre creep).
  if (vx === 0 && vz === 0 && Math.hypot(state.vx, state.vz) < .03 && Math.hypot(state.ax, state.az) < .5) { state.vx = state.vz = state.ax = state.az = 0; return; }
  const w = limits.omega ?? 6;
  let jx = w * w * (vx - state.vx) - 2 * w * state.ax, jz = w * w * (vz - state.vz) - 2 * w * state.az;
  const jerkScale = Math.min(1, limits.jerk / (Math.hypot(jx, jz) || 1));
  jx *= jerkScale; jz *= jerkScale;
  state.ax += jx * FIXED_DT; state.az += jz * FIXED_DT;
  const accelerationScale = Math.min(1, limits.acceleration / (Math.hypot(state.ax, state.az) || 1));
  state.ax *= accelerationScale; state.az *= accelerationScale;
  state.vx += state.ax * FIXED_DT; state.vz += state.az * FIXED_DT;
}
export function faceMotion(state: MotionResponse, yaw: number, vx: number, vz: number): number {
  const target = Math.hypot(vx, vz) < .025 ? 0 : Math.max(-motionLimits.turnSpeed, Math.min(motionLimits.turnSpeed, angleDelta(yaw, -Math.atan2(vz, vx)) * 10));
  state.omega += Math.max(-motionLimits.angularAcceleration * FIXED_DT, Math.min(motionLimits.angularAcceleration * FIXED_DT, target - state.omega));
  return yaw + state.omega * FIXED_DT;
}
