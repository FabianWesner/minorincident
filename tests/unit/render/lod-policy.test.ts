import { expect, test } from 'vitest';
import { initialDistrictLods, lodPolicy, modelLod, pickLod, propLod, useBakedCrowdPose, useBakedCivilianPose, canHoldCrowdPose } from '../../../src/render/lodPolicy';

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
  expect(modelLod(7, 'high', false)).toBe('lod0');
});

test('@load phone initial downloads include only tiers used at the spawn', () => {
  expect(initialDistrictLods(true, true, 0)).toEqual(['lod2']);
  expect(initialDistrictLods(true, false, 16, true)).toEqual(['lod1']);
  expect(initialDistrictLods(true, false, 0)).toEqual(['lod1', 'lod2']);
  expect(initialDistrictLods(true, false, 16.01)).toEqual(['lod2']);
  expect(initialDistrictLods(false, true, 100)).toEqual(['lod1', 'lod2']);
  // lod-pop: nothing the first frames draw at LOD0/LOD1 may open on the LOD2 stand-in, with or without the WebGL spawn warm-up.
  expect(initialDistrictLods(false, false, 0, true)).toEqual(['lod1', 'lod2']);
  expect(initialDistrictLods(false, false, lodPolicy.lod2From, true)).toEqual(['lod1', 'lod2']);
  expect(initialDistrictLods(false, false, lodPolicy.lod2From + lodPolicy.hysteresis + .01, true)).toEqual(['lod2']);
  expect(initialDistrictLods(false, false, 0, true)).toEqual(['lod1', 'lod2']);
  expect(initialDistrictLods(false, false, 46, true)).toEqual(['lod2']);
});

test('@E18-AC01 crowd screen-size hysteresis holds detail through boundary jitter', async () => {
  const { crowdLod } = await import('../../../src/render/lodPolicy');
  expect(crowdLod(97)).toBe('lod1');
  expect(crowdLod(89, 'lod1')).toBe('lod1');
  expect(crowdLod(87, 'lod1')).toBe('lod2');
  expect(crowdLod(103, 'lod2')).toBe('lod2');
  expect(crowdLod(105, 'lod2')).toBe('lod1');
});

// PROD P1 "this guy looks terrible": the low tier forced the ~1.8k-triangle far silhouette (LOD2) onto every pedestrian,
// and high showed it below 160 px, i.e. at the default game camera (figures 120-180 CSS px). Any figure at game-camera
// size or closer must take the near tier, whatever its band history.
test('P1 crowd figures at game-camera size or closer never draw the far silhouette tier', async () => {
  const { crowdLod } = await import('../../../src/render/lodPolicy');
  for (const pixels of [105, 120, 160, 180, 300, 900]) for (const previous of [undefined, 'lod1', 'lod2'] as const) expect(crowdLod(pixels, previous)).toBe('lod1');
});

test('@E18-AC01 small prop screen-size hysteresis keeps both boundaries stable', () => {
  expect(propLod(129)).toBe('lod0'); expect(propLod(127)).toBe('lod1'); expect(propLod(39)).toBe('lod2');
  expect(propLod(113, 'lod0')).toBe('lod0'); expect(propLod(111, 'lod0')).toBe('lod1');
  expect(propLod(143, 'lod1')).toBe('lod1'); expect(propLod(145, 'lod1')).toBe('lod0');
  expect(propLod(35, 'lod1')).toBe('lod1'); expect(propLod(33, 'lod1')).toBe('lod2');
  expect(propLod(45, 'lod2')).toBe('lod2'); expect(propLod(47, 'lod2')).toBe('lod1');
});


test('phone baked poses retain desktop, nearby, large, reacting and special figures', () => {
  const e = { archetype: 'infected.runner', infected: { state: 'chase', legLost: false } } as import('../../../src/sim/world/types').EntitySnapshot;
  const pick = (low = true, distant = true, pixels = 50, distance = 20) => useBakedCrowdPose(e, low, distant, pixels, distance, 10);
  for (const state of ['idle', 'wander', 'search', 'attracted', 'chase'] as const) { e.infected!.state = state; expect(pick()).toBe(true); }
  expect(pick(false)).toBe(false); expect(pick(true, false)).toBe(false);
  expect(pick(true, true, 120)).toBe(true); expect(pick(true, true, 159)).toBe(true); expect(pick(true, true, 160)).toBe(false); expect(pick(true, true, 50, 1.25)).toBe(false); expect(pick(true, true, 50, 1.26)).toBe(true); expect(pick(true, true, 50, 2)).toBe(true);
  e.combat = { radius: .6 } as NonNullable<typeof e.combat>; expect(pick(true, true, 50, 1.5)).toBe(false); expect(pick(true, true, 50, 1.51)).toBe(true); delete e.combat;
  e.infected!.state = 'attack'; expect(pick()).toBe(false); expect(pick(true, true, 50, 1.3)).toBe(false); expect(canHoldCrowdPose(e, 10)).toBe(true); e.infected!.state = 'chase';
  e.infected!.roar = { sourceId: 1, attackId: 1, x: 0, z: 0, until: 20 }; expect(pick()).toBe(false); delete e.infected!.roar;
  e.infected!.legLost = true; expect(pick()).toBe(false); e.infected!.legLost = false;
  e.archetype = 'infected.alpha'; expect(pick()).toBe(false); e.archetype = 'infected.runner';
  e.combat = { reaction: { until: 20 } } as NonNullable<typeof e.combat>; expect(pick()).toBe(false);
});

test('phone pedestrian gait band preserves story actions, pets and close figures', () => {
  const e = { civilian: { state: 'calm' } } as import('../../../src/sim/world/types').EntitySnapshot;
  const pick = (clip = 'npc-walk', low = true, distant = true, pixels = 50, distance = 20) => useBakedCivilianPose(e, low, distant, pixels, distance, clip);
  for (const state of ['calm', 'flee', 'alarmed'] as const) { e.civilian!.state = state; expect(pick()).toBe(true); }
  expect(pick('swing')).toBe(false); expect(pick('civ-startle')).toBe(false); expect(pick('npc-water')).toBe(false);
  expect(pick('npc-walk', false)).toBe(false); expect(pick('npc-walk', true, false)).toBe(false);
  expect(pick('npc-walk', true, true, 120)).toBe(true); expect(pick('npc-walk', true, true, 159)).toBe(true); expect(pick('npc-walk', true, true, 160)).toBe(false); expect(pick('npc-walk', true, true, 50, 2)).toBe(false);
  e.civilian!.state = 'down'; expect(pick()).toBe(false); e.civilian!.state = 'calm';
  e.civilian!.story = { clip: 'npc-look-around', start: 0 }; expect(pick()).toBe(false); delete e.civilian!.story;
  e.civilian!.pet = 'dog'; expect(pick()).toBe(false);
});
