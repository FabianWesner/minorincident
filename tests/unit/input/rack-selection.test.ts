import { expect, test } from 'vitest';
import { Loadout } from '../../../src/sim/combat/Loadout';
import { emptyInput } from '../../../src/input/InputFrame';
import { View } from '../../../src/render/View';

test('@E03-AC05 direct slots select only the requested side and preserve rack timers', () => {
  const loadout=new Loadout(['weapon.bat','weapon.crowbar','weapon.machete'],['weapon.kick','weapon.fists']);
  loadout.state.LEFT.rack[2].readyAt=99;
  loadout.input({...emptyInput(),selectedSlot:{side:'LEFT',index:2}},1);
  expect(loadout.state.LEFT.index).toBe(2);expect(loadout.state.RIGHT.index).toBe(0);
  expect(loadout.state.LEFT.rack[2].readyAt).toBe(99);expect(loadout.state.LEFT.swapUntil).toBe(16);
  loadout.input({...emptyInput(),selectedSlot:{side:'RIGHT',index:1}},20);
  expect(loadout.state.selectedSide).toBe('RIGHT');expect(loadout.state.RIGHT.index).toBe(1);
  loadout.input({...emptyInput(),selectedSlot:{side:'RIGHT',index:2}},40);
  expect(loadout.state.RIGHT.index).toBe(1);
});

test('@E02-AC03 @E03-AC03 zoom smooths, clamps, preserves angle/follow and resets to close default', () => {
  const view=new View();view.resize(1600,900);view.reset({x:0,z:0});
  view.zoom(100);view.update({x:20,z:0},1/60);
  expect(view.radius).toBeGreaterThan(19);expect(view.radius).toBeLessThan(19*1.35);
  for(let i=0;i<120;i++)view.update({x:20,z:0},1/60);
  expect(view.radius).toBeCloseTo(19*1.35,3);expect(view.focus.x).toBeCloseTo(20,3);
  view.zoom(-100);for(let i=0;i<120;i++)view.update({x:20,z:0},1/60);
  expect(view.radius).toBeCloseTo(19*.85,3);expect(view.getState().polar).toBe(Math.PI*.30);
  view.reset({x:0,z:0});expect(view.radius).toBe(19);
});

test('@E03-AC17 carried cycle deduplicates unarmed and preserves active timers', () => {
  const loadout = new Loadout(['weapon.fists', 'weapon.bat'], ['weapon.kick', 'weapon.grenade']);
  expect(loadout.activeEntries().map(e => e.id)).toEqual(['weapon.fists', 'weapon.bat', 'weapon.grenade']);
  loadout.state.LEFT.rack[0].readyAt = 100;
  for (const [tick, id] of [[1, 'weapon.bat'], [20, 'weapon.grenade'], [40, 'weapon.fists']] as const) {
    loadout.input({ ...emptyInput(), selector: 1, selectorActive: true }, tick);
    expect(loadout.current(loadout.state.selectedSide).id).toBe(id);
  }
  expect(loadout.state.LEFT.rack[0].readyAt).toBe(100);
});

test('@E03-AC17 rapid active cycling advances each press during the swap delay', () => {
  const loadout = new Loadout(['weapon.fists', 'weapon.bat'], ['weapon.grenade']);
  loadout.cycleActive(1, 1); loadout.cycleActive(1, 2);
  expect(loadout.current(loadout.state.selectedSide).id).toBe('weapon.grenade');
  expect(loadout.usable('RIGHT', 2)).toBe(false);
});
