import { expect, it } from 'vitest';
import { finaleDodgeGoal } from '../../tools/playtest/combat';

it('a resumed L10 boss fight retreats without a remembered console; charging stays tethered', () => {
  const player = { x: 4, z: 0 }, enemy = { x: 2, z: 0, d: 2 };
  const retreat = finaleDodgeGoal('L10', 'mega', player, null, enemy)!;
  expect(Math.hypot(retreat.x - enemy.x, retreat.z - enemy.z)).toBeGreaterThan(enemy.d);
  expect(finaleDodgeGoal('L10', 'hold', player, null, enemy)).toBeNull();
  const console = { x: 0, z: 0 };
  const charge = finaleDodgeGoal('L10', 'hold', player, console, enemy)!;
  expect(Math.hypot(charge.x - console.x, charge.z - console.z)).toBeLessThan(23);
});
