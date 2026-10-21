import { expect, test } from 'vitest';
import { frameInterval, type FrameState } from '../../tools/playtest/frames';

const playing = (at: number): FrameState => ({ at, level: 'L10', tick: 0, phase: 'playing', loading: false, x: 547, z: 0 });

test('PO #100 queued loading stalls keep their recorded loading status when polled during play', () => {
  const loading = { ...playing(100), loading: true };
  const recorded = frameInterval(playing(0), loading, null);
  expect(recorded.loading).toBe(true); expect(recorded.playMs).toBe(0);
  // Polling it after loading completes cannot reclassify the earlier record.
  expect(frameInterval(loading, playing(3000), 2990).playMs).toBe(10);
});

test('PO #100 the first post-card frame and later gameplay stalls remain guarded at 200 ms', () => {
  expect(frameInterval({ ...playing(0), loading: true }, playing(3300), 3000).playMs).toBe(300);
  expect(frameInterval(playing(3300), { ...playing(4170), tick: 2965, x: 755, z: 13.6 }, 3000)).toMatchObject({ playMs: 870, tick: 2965, x: 755, z: 13.6 });
  expect(frameInterval({ ...playing(0), level: 'L9' }, playing(2800), 2790).playMs).toBe(10);
  expect(frameInterval({ ...playing(0), level: 'L9' }, playing(3300), 3000).playMs).toBe(300);
});
