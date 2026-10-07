import { expect, test } from 'vitest';
import { lodPolicy, modelLod, pickLod } from '../../../src/render/lodPolicy';

test('@E19 @E19-AC24 near assets retain LOD0; the rest of the view uses authored distance LODs', () => {
  expect(pickLod(0)).toBe('lod0'); expect(pickLod(7)).toBe('lod0'); expect(pickLod(9)).toBe('lod1'); expect(pickLod(25)).toBe('lod2');
  expect(lodPolicy.lod1From).toBe(8);
});

test('@load hysteresis: a band changes only past the boundary plus the margin', () => {
  expect(pickLod(9, 'lod0')).toBe('lod0'); expect(pickLod(10.5, 'lod0')).toBe('lod1');
  expect(pickLod(7, 'lod1')).toBe('lod1'); expect(pickLod(5.5, 'lod1')).toBe('lod0');
  expect(pickLod(25, 'lod1')).toBe('lod1'); expect(pickLod(26.5, 'lod1')).toBe('lod2'); expect(pickLod(23, 'lod2')).toBe('lod2'); expect(pickLod(21.5, 'lod2')).toBe('lod1');
  // A jump across two bands switches immediately.
  expect(pickLod(120, 'lod0')).toBe('lod2'); expect(pickLod(4, 'lod2')).toBe('lod0');
});

test('@load low tier keeps its budget for individually loaded models', () => {
  expect(modelLod(5, undefined, true)).toBe('lod1'); expect(modelLod(31, 'lod1', true)).toBe('lod2');
  expect(modelLod(4, 'high', false)).toBe('lod0');
});
