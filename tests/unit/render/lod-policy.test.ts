import { expect, test } from 'vitest';
import { initialDistrictLods, lodPolicy, modelLod, pickLod } from '../../../src/render/lodPolicy';

test('@load play view renders LOD0; LOD1 beyond 45 m, LOD2 beyond 90 m', () => {
  expect(pickLod(0)).toBe('lod0'); expect(pickLod(44)).toBe('lod0'); expect(pickLod(46)).toBe('lod1'); expect(pickLod(91)).toBe('lod2');
  // Max zoom (19 m x 1.45, x1.15 driving) keeps the whole view well inside the LOD0 band.
  expect(19 * 1.45 * 1.15).toBeLessThan(lodPolicy.lod1From);
});

test('@load hysteresis: a band changes only past the boundary plus the margin', () => {
  expect(pickLod(47, 'lod0')).toBe('lod0'); expect(pickLod(49.5, 'lod0')).toBe('lod1');
  expect(pickLod(43, 'lod1')).toBe('lod1'); expect(pickLod(40.5, 'lod1')).toBe('lod0');
  expect(pickLod(92, 'lod1')).toBe('lod1'); expect(pickLod(95, 'lod1')).toBe('lod2'); expect(pickLod(88, 'lod2')).toBe('lod2'); expect(pickLod(85, 'lod2')).toBe('lod1');
  // A jump across two bands switches immediately.
  expect(pickLod(120, 'lod0')).toBe('lod2'); expect(pickLod(10, 'lod2')).toBe('lod0');
});

test('@load low tier keeps its budget for individually loaded models', () => {
  expect(modelLod(5, undefined, true)).toBe('lod1'); expect(modelLod(31, 'lod1', true)).toBe('lod2');
  expect(modelLod(20, 'high', false)).toBe('lod0');
});

test('@load phone initial downloads include only tiers used at the spawn', () => {
  expect(initialDistrictLods(true, true, 0)).toEqual(['lod2']);
  expect(initialDistrictLods(true, false, 16, true)).toEqual(['lod1']);
  expect(initialDistrictLods(true, false, 0)).toEqual(['lod1', 'lod2']);
  expect(initialDistrictLods(true, false, 16.01)).toEqual(['lod2']);
  expect(initialDistrictLods(false, true, 100)).toEqual(['lod1', 'lod2']);
  expect(initialDistrictLods(false, false, 0, true, true)).toEqual(['lod2']);
  expect(initialDistrictLods(false, false, 0, true)).toEqual(['lod1', 'lod2']);
  expect(initialDistrictLods(false, false, 46, true)).toEqual(['lod2']);
});
