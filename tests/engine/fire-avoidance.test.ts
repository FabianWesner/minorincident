import { expect, test } from 'vitest';
import { avoidFieldFire } from '../../src/sim/npc/avoidFieldFire';

test('followers choose a clear waypoint away from a burning crop block', () => {
  const cell = { id: 'crop', x: 10, z: 0, state: 'burning' as const, ignitedAt: 0 };
  const target = { x: 20, z: 0 };
  expect(avoidFieldFire({ x: 0, z: 0 }, target, [cell], () => true)).toEqual({ x: 8, z: -8 });
  expect(avoidFieldFire({ x: 0, z: 0 }, target, [cell], () => false)).toBeNull();
  expect(avoidFieldFire({ x: 0, z: 0 }, target, [{ ...cell, state: 'scorched' }], () => true)).toBe(target);
});


test('the chosen detour does not cross a neighboring burning block', () => {
  const cells = [{ id: 'a', x: 10, z: 0, state: 'burning' as const, ignitedAt: 0 }, { id: 'b', x: 8, z: -8, state: 'burning' as const, ignitedAt: 0 }];
  expect(avoidFieldFire({ x: 0, z: 0 }, { x: 20, z: 0 }, cells, () => true)).toEqual({ x: 8, z: 8 });
});
