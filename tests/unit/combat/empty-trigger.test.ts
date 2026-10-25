import { expect, test } from 'vitest';
import { emptyInput } from '../../../src/input/InputFrame';
import { action } from '../../../src/data/actions/catalog';
import { eventCues } from '../../../src/data/audioCues';
import { arena, dummy } from '../../sim/combat/helpers';

for (const weapon of ['weapon.army-mg', 'weapon.grenade']) for (const click of [false, true]) test(`@E05 Q-161 ${weapon} empty trigger (${click ? 'mouse target' : 'key'}) clicks once and selects the best usable carried weapon`, async () => {
  const w = await arena(), combat = w.combat!;
  combat.actionDefinitions = { 'weapon.army-mg': { ...action('weapon.army-mg'), magazine: 6, reloadTime: 1 } };
  combat.setLoadout(['weapon.fire-axe'], [weapon, 'weapon.handgun', 'weapon.pipe-bomb']);
  const loadout = combat.runner.loadout;
  loadout.state.selectedSide = 'RIGHT'; loadout.current('RIGHT').magazine = 0; loadout.current('RIGHT').charges = 0; loadout.state.RIGHT.rack[2].charges = 0;
  const id = dummy(w, 2), frame = emptyInput(); frame.aim = { x: 1, z: 0 };
  if (click) { frame.mouseAttack = frame.pointerTarget = true; frame.attackTarget = { id, side: 'LEFT' }; frame.left.down = frame.left.held = true; }
  else frame.right.down = frame.right.held = true;
  w.applyInput(frame, 'mouse-keyboard'); w.update();
  expect(w.events.events().filter(e => e.type === 'combat.empty')).toEqual([expect.objectContaining({ actionId: weapon, sourceId: 1 })]);
  expect(eventCues['combat.empty']).toBe('weapon.dry');
  expect(loadout.current(loadout.state.selectedSide).id).toBe('weapon.handgun');
  expect(w.events.events().filter(e => e.type === 'combat.attack')).toHaveLength(0);
  expect(loadout.state.RIGHT.rack[0].magazine).toBe(0);
});
