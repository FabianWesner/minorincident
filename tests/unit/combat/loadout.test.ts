import { expect, test } from 'vitest';
import { emptyInput } from '../../../src/input/InputFrame';
import { Loadout } from '../../../src/sim/combat/Loadout';
import { ActionRunner } from '../../../src/sim/combat/ActionRunner';
import { actions, action } from '../../../src/data/actions/fixtures';
import { validateAction } from '../../../src/data/actions/schema';

test('T-E05-schema @E05 reference actions validate and invalid timers/query values fail', () => {
  for (const def of Object.values(actions)) expect(validateAction(def)).toBe(def);
  for (const patch of [{ damage: NaN }, { maxTargets: 0 }, { charges: 2, recharge: 0 }, { reloadTime: 0, magazine: 2 }, { arc: 361 }]) expect(() => validateAction({ ...action('weapon.bat'), ...patch })).toThrow();
  expect(() => new Loadout([], ['weapon.bat'])).toThrow(); expect(() => new Loadout(['unknown'], ['weapon.bat'])).toThrow();
});
test('T-E05-phases @E05 windup, active and recovery are fixed tick phases and interruptible', () => {
  const rack = new Loadout(['weapon.bat'], ['weapon.grenade']), runner = new ActionRunner(1, rack), starts: number[] = [], hits: number[] = [];
  const frame = emptyInput(); frame.left.held = true;
  for (let tick = 1; tick <= 35; tick++) runner.update(frame, tick, true, () => starts.push(tick), () => hits.push(tick));
  expect(starts).toEqual([1, 31]); expect(hits).toEqual([7]);
  runner.update(frame, 36, false, () => {}, () => {}); expect(runner.running.LEFT).toBeUndefined();
});

test('T-E05-slot-timers @E05 rack cycling preserves ammo, charge timers and reloads', () => {
  const rack = new Loadout(['weapon.pistol', 'weapon.grenade'], ['weapon.bat']);
  const pistol = rack.current('LEFT');
  for (let tick = 1; tick <= 76; tick += 15) rack.spend('LEFT', tick, action('weapon.pistol'), false);
  const frame = emptyInput(); frame.selector = 1; rack.input(frame, 77); rack.update(92, () => {});
  expect(pistol.magazine).toBe(0); expect(rack.current('LEFT').id).toBe('weapon.grenade');
  rack.spend('LEFT', 92, action('weapon.grenade'), false); const grenade = rack.current('LEFT');
  rack.input(frame, 100); rack.update(136, () => {}); expect(pistol.magazine).toBe(6);
  rack.update(811, () => {}); expect(grenade.charges).toBe(1); rack.update(812, () => {}); expect(grenade.charges).toBe(2);
});
