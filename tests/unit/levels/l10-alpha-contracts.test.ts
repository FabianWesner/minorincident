import { expect, test } from 'vitest';
import { cureAlphaCap, cureAlphaCounts } from '../../../src/levels/L10/alphaContracts';
import { dogCoats, dogModel, dogCoat } from '../../../src/data/dogAppearance';
import { infectedDef, infectedSpecialMoves, alphaDamageMultiplier } from '../../../src/data/infected';

test('T-E32-09a @E32 @E32-AC09 regular Alpha region ranges and high/low assault limits match the epic', () => {
  expect(Object.values(cureAlphaCounts)).toEqual([[0, 0], [0, 0], [1, 1], [1, 2], [1, 2], [2, 3], [0, 3]]);
  for (const region of Object.keys(cureAlphaCounts) as (keyof typeof cureAlphaCounts)[]) {
    expect(cureAlphaCap(region, 'high')).toBe(cureAlphaCounts[region][1]);
    expect(cureAlphaCap(region, 'low')).toBe(region === 'dispersal-complex' ? 2 : cureAlphaCounts[region][1]);
  }
  const def = infectedDef('infected.alpha');
  expect(def.bar).toBe(true); expect(def.hp).toBe(200); expect(def.asset).toBe('inf.alpha');
  expect(Object.keys(infectedSpecialMoves).filter(m => m.startsWith('alpha.'))).toEqual(['alpha.charge', 'alpha.ground-slam', 'alpha.grab-throw', 'alpha.roar']);
  expect(alphaDamageMultiplier('weapon.pistol', 'bullet')).toBe(.5);
  expect(alphaDamageMultiplier('weapon.shotgun', 'bullet')).toBe(.8);
});

test('T-E32-07-coats @E32 @E32-AC07 seeded dog coats are stable, cover all assets and preserve healthy/infected identity', () => {
  for (const seed of [1, 10, 32]) {
    const coats = Array.from({ length: 40 }, (_, i) => dogModel(seed, i + 2, true));
    expect(new Set(coats)).toEqual(new Set(['inf.dog', 'inf.dog.black', 'inf.dog.cream']));
    expect(coats).toEqual(Array.from({ length: 40 }, (_, i) => dogModel(seed, i + 2, true)));
    coats.forEach((model, i) => expect(dogModel(seed, i + 2, false).replace('amb.', 'inf.')).toBe(model));
  }
  expect(dogCoats).toHaveLength(3); expect(dogCoat('inf.dog.black')).toBe('black'); expect(dogCoat('inf.dog')).toBeUndefined();
  expect(dogModel(10, 2, true)).not.toBe(dogModel(32, 2, true));
});
