import { expect, test } from 'vitest';
import { catalog, mountedActions } from '../../src/data/actions/catalog';
import { weaponOrder } from '../../src/data/weaponOrder';
import { emptyInput } from '../../src/input/InputFrame';
import { arena, step } from './combat/helpers';

// PO #14: L4's axe/bat/kick + handgun/lure/molotov rack is in acquisition order.
test('PO #14 @E03 one fixed weapon order drives active, rack, number and touch selection after restore', async () => {
  expect(new Set(weaponOrder).size).toBe(weaponOrder.length);
  expect([...Object.keys(catalog), ...Object.keys(mountedActions)].filter(id => !(weaponOrder as readonly string[]).includes(id))).toEqual([]);
  const w = await arena(), combat = w.combat!;
  combat.setLoadout(['weapon.fire-axe', 'weapon.bat', 'weapon.kick'], ['ability.corgi-lure', 'weapon.molotov', 'weapon.handgun']);
  const loadout = combat.runner.loadout;
  const expected = ['weapon.fists', 'weapon.bat', 'weapon.fire-axe', 'weapon.handgun', 'weapon.molotov', 'ability.corgi-lure'];
  expect(loadout.activeEntries().map(e => e.id)).toEqual(expected);
  for (let index = 0; index < expected.length; index++) {
    loadout.input({ ...emptyInput(), selectedActiveSlot: index }, 30 * index + 30);
    const id = loadout.current(loadout.state.selectedSide).id;
    expect(id === 'weapon.kick' ? 'weapon.fists' : id).toBe(expected[index]);
  }
  loadout.input({ ...emptyInput(), selectedActiveSlot: 0 }, 210);
  for (let i = 1; i <= expected.length; i++) {
    loadout.input({ ...emptyInput(), selectorActive: true, selector: 1 }, 211 + i);
    expect(loadout.activeEntries().find(e => e.side === loadout.state.selectedSide && e.index === loadout.state[e.side].index)?.id).toBe(expected[i % expected.length]);
  }
  // Touch/HUD cycle and keyboard numbers address the same sorted side rack.
  loadout.input({ ...emptyInput(), selectedSlot: { side: 'LEFT', index: 0 }, orderedSelection: true }, 240);
  expect(loadout.current('LEFT').id).toBe('weapon.kick');
  loadout.input({ ...emptyInput(), selectorSide: 'LEFT', selector: 1 }, 270);
  expect(loadout.current('LEFT').id).toBe('weapon.bat');
  loadout.input({ ...emptyInput(), selectorSide: 'LEFT', selector: -1 }, 300);
  expect(loadout.current('LEFT').id).toBe('weapon.kick');
  // Rebuilding from a checkpoint's storage order must not change the carried list.
  const saved = structuredClone(loadout.state);
  combat.setLoadout(saved.LEFT.rack.map(s => s.id), saved.RIGHT.rack.map(s => s.id));
  expect(combat.runner.loadout.activeEntries().map(e => e.id)).toEqual(expected);
  // Retained pickups preserve their timers and join their fixed position immediately.
  combat.runner.loadout.collect('RIGHT', 'weapon.smg', true); step(w, 1);
  expect(combat.runner.loadout.activeEntries().map(e => e.id)).toEqual([...expected.slice(0, 4), 'weapon.smg', ...expected.slice(4)]);
});
