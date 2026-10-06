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
export function respond(state: MotionResponse, vx: number, vz: number): void {
  if (vx === 0 && vz === 0 && Math.hypot(state.vx, state.vz, state.ax, state.az) < 1e-6) { state.vx = state.vz = state.ax = state.az = 0; return; }
  let jx = 36 * (vx - state.vx) - 12 * state.ax, jz = 36 * (vz - state.vz) - 12 * state.az;
  const jerkScale = Math.min(1, motionLimits.jerk / (Math.hypot(jx, jz) || 1));
  jx *= jerkScale; jz *= jerkScale;
  state.ax += jx * FIXED_DT; state.az += jz * FIXED_DT;
  const accelerationScale = Math.min(1, motionLimits.acceleration / (Math.hypot(state.ax, state.az) || 1));
  state.ax *= accelerationScale; state.az *= accelerationScale;
  state.vx += state.ax * FIXED_DT; state.vz += state.az * FIXED_DT;
}
export function faceMotion(state: MotionResponse, yaw: number, vx: number, vz: number): number {
  const target = Math.hypot(vx, vz) < .025 ? 0 : Math.max(-motionLimits.turnSpeed, Math.min(motionLimits.turnSpeed, angleDelta(yaw, -Math.atan2(vz, vx)) * 10));
  state.omega += Math.max(-motionLimits.angularAcceleration * FIXED_DT, Math.min(motionLimits.angularAcceleration * FIXED_DT, target - state.omega));
  return yaw + state.omega * FIXED_DT;
}
