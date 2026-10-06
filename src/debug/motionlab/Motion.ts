import { respond, faceMotion } from '../../sim/locomotion/MotionResponse';
/** Evaluation-only policies; no gameplay state is read or written. */
export const dt = 1 / 60;
export const angleDelta = (from: number, to: number) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
export interface Motion { x: number; z: number; yaw: number; vx: number; vz: number; ax: number; az: number; omega: number; updatedAt: number; distance: number; speed: number }
export function motion(): Motion { return { x: 0, z: 0, yaw: 0, vx: 0, vz: 0, ax: 0, az: 0, omega: 0, updatedAt: -1, distance: 0, speed: 0 }; }
export function intent(tick: number): { x: number; z: number } {
  const t = tick % 720;
  return t < 90 ? { x: 0, z: 0 } : t < 150 ? { x: .3, z: 0 } : t < 240 ? { x: 1, z: 0 } : t < 360 ? { x: 0, z: 1 } : t < 420 ? { x: 0, z: 0 } : t < 570 ? { x: -1, z: 0 } : { x: 0, z: -1 };
}
export function steer(state: Motion, input: { x: number; z: number }, speed: number, prototype: boolean, civilian = false): void {
  if (prototype) {
    respond(state, input.x * speed, input.z * speed);
  } else { state.vx = input.x * speed; state.vz = input.z * speed; }
  state.x += state.vx * dt; state.z += state.vz * dt;
  state.speed = Math.hypot(state.vx, state.vz); state.distance += state.speed * dt;
  if (prototype) state.yaw = faceMotion(state, state.yaw, state.vx, state.vz);
  else if (state.speed >= .025) {
    const delta = angleDelta(state.yaw, -Math.atan2(state.vz, state.vx));
    state.yaw += civilian ? Math.max(-.12, Math.min(.12, delta)) : delta;
  }

}
export function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b); return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
}
export function rootMetrics(samples: { x: number; z: number; yaw: number }[]) {
  const velocity = samples.slice(1).map((s, i) => ({ x: (s.x - samples[i].x) / dt, z: (s.z - samples[i].z) / dt }));
  const acceleration = velocity.slice(1).map((v, i) => ({ x: (v.x - velocity[i].x) / dt, z: (v.z - velocity[i].z) / dt }));
  const jerk = acceleration.slice(1).map((a, i) => Math.hypot(a.x - acceleration[i].x, a.z - acceleration[i].z) / dt);
  const turns = samples.slice(1).map((s, i) => angleDelta(samples[i].yaw, s.yaw) / dt);
  const angularAcceleration = turns.slice(1).map((v, i) => Math.abs(v - turns[i]) / dt);
  return { jerkRmsMps3: Math.sqrt(jerk.reduce((sum, j) => sum + j * j, 0) / jerk.length), jerkPeakMps3: Math.max(...jerk), turnPeakDegPerFrame: Math.max(...turns.map(Math.abs)) * dt * 180 / Math.PI, angularAccelerationPeakRadps2: Math.max(...angularAcceleration) };
}
