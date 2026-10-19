import { isDeepStrictEqual } from 'node:util';
import { expect, test } from 'vitest';
import { cloneData } from '../../../src/core/clone';
import { sameClone } from '../../fixtures/sameClone';

test('T-E22-20-clone @E22-AC20 checkpoint copies equal structuredClone, keep shared references and fall back for other types', () => {
  const shared = { x: 1, z: -0 }, cyclic: Record<string, unknown> = { name: 'loop' }; cyclic.self = cyclic;
  const data = [{ id: 1, at: shared, path: [shared, { x: 2, z: 3 }], none: undefined, nan: NaN, inf: -Infinity, big: 5n, nested: { list: [[1, 2], []] } }, { id: 2, facing: shared, cyclic }];
  const copy = cloneData(data);
  expect(sameClone(data, copy, structuredClone(data))).toBe(true);
  const [first, second] = copy as unknown as [{ at: { z: number }; path: unknown[] }, { facing: unknown }];
  expect(first.at).toBe(first.path[0]); expect(second.facing).toBe(first.at); expect(first.at).not.toBe(shared);
  expect(Object.is(first.at.z, -0)).toBe(true); expect('none' in first).toBe(true);
  // Other types (and sparse arrays) take the structuredClone path: same result, never a partial plain copy.
  for (const odd of [{ m: new Map([[1, { a: 1 }]]) }, { s: new Set([1]) }, { t: new Float32Array([1, 2]) }, { d: new Date(5) }, { sparse: [1, , 3] }, { extra: Object.assign([1, 2], { tag: 'x' }) }, { proto: Object.create(null) as object }]) {
    expect(isDeepStrictEqual(cloneData(odd), structuredClone(odd))).toBe(true);
  }
  expect(() => cloneData({ f: () => 1 })).toThrow();
});
