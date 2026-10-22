import { expect, test } from 'vitest';
import { clickGroundInput, markerWalkKeys } from '../../tools/playtest/input';

test('#102 raised exit steering retains the small correction toward the visible stair centre', () => {
  const frames = Array.from({ length: 12 }, (_, i) => markerWalkKeys(12, 4, i / 12));
  expect(frames.every(keys => keys.includes('KeyD'))).toBe(true);
  expect(frames.filter(keys => keys.includes('KeyS'))).toHaveLength(4);
  expect(markerWalkKeys(0, 0, 0)).toEqual([]);
});

test('#99 approaching a visible ally attacker releases held walking/attack keys before clicking', async () => {
  const calls: string[] = [];
  await clickGroundInput({
    releaseKeys: async () => { calls.push('keys-up'); },
    releaseAim: async () => { calls.push('aim-up'); },
    mouse: {
      move: async (x,y) => { calls.push(`move ${x} ${y}`); },
      down: async () => { calls.push('mouse-down'); },
      up: async () => { calls.push('mouse-up'); },
    },
  }, 640, 360);
  expect(calls).toEqual(['keys-up','aim-up','move 640 360','mouse-down','mouse-up']);
});
