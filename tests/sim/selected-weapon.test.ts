import { expect, test } from 'vitest';
import { catalog } from '../../src/data/actions/catalog';
import { arena, dummy, equip, health, step } from './combat/helpers';

// PO #9: the L3 handgun is selected on RIGHT while the bat remains on LEFT.
test('PO #9 @E03 Space uses the selected weapon for every carried action category', async () => {
  for (const def of Object.values(catalog)) {
    const w = await arena(); equip(w, ['weapon.bat'], [def.id]);
    w.combat!.runner.loadout.state.selectedSide = 'RIGHT';
    const target = dummy(w, 1, 0, 10000);
    w.setInput({ activeAttack: true, aim: { x: 1, z: 0 }, left: { down: true, held: false, up: true } });
    step(w, 1); w.clearInput(); step(w, 45);
    const attacks = w.events.events().filter(e => e.type === 'combat.attack');
    expect(attacks.map(e => e.actionId), def.id).toEqual([def.id]);
    expect(attacks[0].side, def.id).toBe('RIGHT');
    if (def.category === 'ranged') expect(health(w, target), `${def.id} actually fires`).toBeLessThan(10000);
  }
  // Magazine fixtures respect reloads; campaign handgun/army MG are bottomless.
  const w = await arena(); equip(w, ['weapon.bat'], ['weapon.smg']);
  const loadout = w.combat!.runner.loadout; loadout.state.selectedSide = 'RIGHT';
  Object.assign(loadout.current('RIGHT'), { magazine: 0, reloadUntil: w.tick + 120 });
  w.setInput({ activeAttack: true, left: { down: true, held: true, up: false } }); step(w, 30);
  expect(w.events.events().filter(e => e.type === 'combat.attack')).toEqual([]);
  expect(loadout.state.selectedSide).toBe('RIGHT');
});
