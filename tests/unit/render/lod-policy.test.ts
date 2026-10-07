import { expect, test } from 'vitest';
import { initialDistrictLods, lodPolicy, modelLod, pickLod, propLod } from '../../../src/render/lodPolicy';

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

test('@E18-AC01 crowd screen-size hysteresis holds detail through boundary jitter and forces low tier', async () => {
  const { crowdLod } = await import('../../../src/render/lodPolicy');
  expect(crowdLod(161, undefined, false)).toBe('lod1');
  expect(crowdLod(145, 'lod1', false)).toBe('lod1');
  expect(crowdLod(143, 'lod1', false)).toBe('lod2');
  expect(crowdLod(175, 'lod2', false)).toBe('lod2');
  expect(crowdLod(177, 'lod2', false)).toBe('lod1');
  expect(crowdLod(300, 'lod1', true)).toBe('lod2');
});

test('@E18-AC01 small prop screen-size hysteresis keeps both boundaries stable', () => {
  expect(propLod(129)).toBe('lod0'); expect(propLod(127)).toBe('lod1'); expect(propLod(39)).toBe('lod2');
  expect(propLod(113, 'lod0')).toBe('lod0'); expect(propLod(111, 'lod0')).toBe('lod1');
  expect(propLod(143, 'lod1')).toBe('lod1'); expect(propLod(145, 'lod1')).toBe('lod0');
  expect(propLod(35, 'lod1')).toBe('lod1'); expect(propLod(33, 'lod1')).toBe('lod2');
  expect(propLod(45, 'lod2')).toBe('lod2'); expect(propLod(47, 'lod2')).toBe('lod1');
});
