import { expect, test } from 'vitest';
import { angleDelta, dt, intent, motion, rootMetrics, steer } from '../../../src/debug/motionlab/Motion';

test('motion lab bounds NPC jerk and turn increments and reproduces the trace', () => {
  const run = () => {
    const state = motion(), trace = [];
    for (let tick = 1; tick <= 720; tick++) {
      const previous = { ...state }; steer(state, intent(tick), 2.4, true);
      expect(Math.hypot(state.ax - previous.ax, state.az - previous.az) / dt).toBeLessThanOrEqual(48 + 1e-8);
      expect(Math.abs(state.omega - previous.omega) / dt).toBeLessThanOrEqual(12 + 1e-8);
      expect(Math.abs(angleDelta(previous.yaw, state.yaw))).toBeLessThanOrEqual(4.5 * dt + 1e-8);
      trace.push({ x: state.x, z: state.z, yaw: state.yaw });
    }
    return trace;
  };
  const trace = run(); expect(run()).toEqual(trace);
  expect(rootMetrics(trace).jerkPeakMps3).toBeLessThan(49);
});

test('motion lab smoothing settles after release instead of walking in place', () => {
  const state = motion(); for (let i = 0; i < 120; i++) steer(state, { x: 1, z: 0 }, 2.4, true);
  for (let i = 0; i < 180; i++) steer(state, { x: 0, z: 0 }, 2.4, true);
  expect(state.speed).toBeLessThan(.01);
});
