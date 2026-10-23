import { expect, test } from 'vitest';
import { campaignCombatWeapon, finaleDodgeGoal } from '../../tools/playtest/combat';

test('L10 selects the recovered campaign arsenal instead of keeping the crash axe', () => {
  const weapons = ['weapon.fire-axe'];
  expect(campaignCombatWeapon('L10', weapons)).toBe('weapon.fire-axe');
  weapons.push('weapon.handgun');
  expect(campaignCombatWeapon('L10', weapons)).toBe('weapon.handgun');
  weapons.push('weapon.shotgun', 'weapon.army-mg', 'weapon.rocket-launcher');
  expect(campaignCombatWeapon('L10', weapons)).toBe('weapon.rocket-launcher');
  expect(campaignCombatWeapon('L10', weapons.filter(id => id !== 'weapon.rocket-launcher'))).toBe('weapon.army-mg');
  expect(campaignCombatWeapon('L10', weapons)).toBe('weapon.rocket-launcher');
  expect(campaignCombatWeapon('L7', weapons)).toBe('weapon.rocket-launcher');
  expect(campaignCombatWeapon('L8', weapons)).toBe('weapon.rocket-launcher');
  expect(campaignCombatWeapon('L6', weapons)).toBeNull();
  expect(campaignCombatWeapon('L10', [])).toBeNull();
  expect(campaignCombatWeapon('L10', ['weapon.fire-axe', 'weapon.pistol'])).toBe('weapon.pistol');
});

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
