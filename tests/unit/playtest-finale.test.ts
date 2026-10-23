import { expect, test } from 'vitest';
import { campaignCombatWeapon, campaignThreat, finaleDodgeGoal, rocketAimPoint } from '../../tools/playtest/combat';

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
  expect(finaleDodgeGoal('L10', 'hold', { x: 0, z: 0 }, { x: 0, z: 0 }, { x: 8, z: 0, d: 8 })).toEqual({ x: -8, z: expect.closeTo(0) });
});

test('L10 boss defence increases separation from contact instead of circling toward the boss', () => {
  const at = finaleDodgeGoal('L10', 'mega', { x: 10, z: 0 }, { x: 0, z: 0 }, { x: 11, z: 0, d: 1 });
  expect(at).toEqual({ x: 2, z: expect.closeTo(0) });
  expect(Math.hypot(at!.x - 11, at!.z)).toBeGreaterThan(8);
});

test('the boss kill objective aims at the visible Mega instead of a nearer walker', () => {
  const walker = { id: 1, hp: 60, max: 60, d: 1, drawn: true }, mega = { id: 2, hp: 3000, max: 3000, d: 10, drawn: true };
  expect(campaignThreat('L10', 'mega', [walker, mega], 30)).toBe(mega);
  expect(campaignThreat('L10', 'hold', [walker, mega], 30)).toBe(walker);
  expect(campaignThreat('L10', 'mega', [walker, { ...mega, drawn: false }], 30)).toBe(walker);
});

test('rocket aim leads a visible body crossing the shot path', () => {
  const player = { x: 0, z: 0 }, enemy = { x: 9, z: 0, vx: 0, vz: 4 };
  const aim = rocketAimPoint(player, enemy), flight = Math.hypot(aim.x, aim.z) / 18;
  expect(aim.x).toBe(9); expect(aim.z).toBeCloseTo(enemy.vz * flight);
  expect(rocketAimPoint(player, { ...enemy, vz: 0 })).toEqual({ x: 9, z: 0 });
});

test('finale dodging needs a visible nearby threat and remembered console, and stays out of other steps', () => {
  for (const [level, step, console, d] of [['L6', 'hold', { x: 0, z: 0 }, 1], ['L10', 'release', { x: 0, z: 0 }, 1], ['L10', 'hold', null, 1], ['L10', 'hold', { x: 0, z: 0 }, 20]] as const) {
    expect(finaleDodgeGoal(level, step, { x: 0, z: 0 }, console, { x: d, z: 0, d })).toBeNull();
  }
});
