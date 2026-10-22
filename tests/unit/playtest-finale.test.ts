import { expect, test } from 'vitest';
import { finaleDodgeGoal } from '../../tools/playtest/combat';

test('L10 defence walks away from a visible approaching enemy instead of standing in the horde', () => {
  expect(finaleDodgeGoal('L10', 'hold', { x: 0, z: 0 }, { x: 0, z: 0 }, { x: 8, z: 0, d: 8 })).toEqual({ x: -12, z: expect.closeTo(0) });
});

test('L10 boss defence circles the remembered visible console within the charge area', () => {
  const at = finaleDodgeGoal('L10', 'mega', { x: 10, z: 0 }, { x: 0, z: 0 }, { x: 11, z: 0, d: 1 });
  expect(at).not.toBeNull(); expect(Math.hypot(at!.x, at!.z)).toBeCloseTo(12);
  expect(at!.z).toBeGreaterThan(0);
});

test('finale dodging needs a visible nearby threat and remembered console, and stays out of other steps', () => {
  for (const [level, step, console, d] of [['L6', 'hold', { x: 0, z: 0 }, 1], ['L10', 'release', { x: 0, z: 0 }, 1], ['L10', 'hold', null, 1], ['L10', 'hold', { x: 0, z: 0 }, 20]] as const) {
    expect(finaleDodgeGoal(level, step, { x: 0, z: 0 }, console, { x: d, z: 0, d })).toBeNull();
  }
});
