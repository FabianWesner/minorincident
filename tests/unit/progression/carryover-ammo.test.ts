import { expect, test, vi } from 'vitest';
import { action } from '../../../src/data/actions/catalog';
import { Loadout } from '../../../src/sim/combat/Loadout';
import { preset } from '../../../src/sim/progression/Campaign';
import { restoreSelectedAction } from '../../../src/sim/progression/selection';

// The real campaign MG is bottomless. A finite definition exercises the empty
// boundary independently, without interpreting its legitimate zero counters as empty.
test('@E13 Q-161 L4→L5 rejects an empty carried finite MG and skips depleted alternatives', () => {
  const save = preset('L5-default'); save.selectedAction = 'weapon.army-mg';
  save.ownedActions.push('weapon.pipe-bomb');
  const loadout = new Loadout(['weapon.fire-axe'], ['weapon.army-mg', 'weapon.handgun', 'weapon.pipe-bomb'], id => id === 'weapon.army-mg' ? { ...action(id), magazine: 6, reloadTime: 1 } : action(id));
  loadout.state.RIGHT.rack[0].magazine = 0;
  loadout.state.RIGHT.rack[2].charges = 0;
  const log = vi.spyOn(console, 'info').mockImplementation(() => undefined);
  expect(restoreSelectedAction(loadout, save)).toBe('weapon.handgun');
  expect(loadout.current(loadout.state.selectedSide).id).toBe('weapon.handgun');
  expect(loadout.state.RIGHT.swapUntil).toBe(0);
  expect(log).toHaveBeenCalledWith(expect.stringContaining('empty'));
});

test('@E13 Q-161 the actual bottomless campaign MG remains usable with zero resource counters', () => {
  const save = preset('L5-default'); save.selectedAction = 'weapon.army-mg';
  const loadout = new Loadout(save.racks.LEFT, save.racks.RIGHT);
  expect(loadout.state.RIGHT.rack.find(s => s.id === 'weapon.army-mg')).toMatchObject({ magazine: 0, charges: 0 });
  expect(restoreSelectedAction(loadout, save)).toBe('weapon.army-mg');
});
