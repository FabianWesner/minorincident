import { expect, test } from 'vitest';
import { ActionRunner } from '../../../src/sim/combat/ActionRunner';
import { Loadout } from '../../../src/sim/combat/Loadout';
import { emptyInput } from '../../../src/input/InputFrame';

function rig(sourceId = 1, gun = 'weapon.handgun') {
  const runner = new ActionRunner(sourceId, new Loadout([gun], ['weapon.bat']));
  const shots: number[] = [], starts: number[] = [];
  let tick = 0;
  return { runner, shots, starts, step(fire = false, aim = false, enabled = true) {
    tick++;
    runner.update({ ...emptyInput(), aim: aim || fire ? { x: 1, z: 0 } : null, aimSource: aim ? 'keyboard' : null,
      left: { down: fire && tick === 1, held: fire, up: false } }, tick, enabled, a => starts.push(a.started), a => shots.push(a.activeAt));
  } };
}

test('@E05 @gun-raise first player tap raises for six ticks and resolves after release', () => {
  const r = rig(); r.step(true);
  expect(r.starts).toEqual([1]); expect(r.shots).toEqual([]);
  for (let i = 0; i < 5; i++) r.step();
  expect(r.shots).toEqual([]); r.step(); expect(r.shots).toEqual([7]);
});

test('@E05 @gun-raise held fire keeps the handgun cadence after the initial 100 ms', () => {
  const r = rig(); for (let i = 0; i < 70; i++) r.step(true);
  expect(r.shots).toEqual([7, 27, 47, 67]);
  const mg = rig(1, 'weapon.army-mg'); for (let i = 0; i < 34; i++) mg.step(true);
  expect(mg.shots).toEqual([7, 13, 19, 25, 31]);
});

test('@E05 @gun-raise prepared aim fires immediately, disabled player cancels, NPC has no raise', () => {
  const ready = rig(); for (let i = 0; i < 6; i++) ready.step(false, true);
  ready.step(true); expect(ready.shots).toEqual([7]);
  const partial = rig(); for (let i = 0; i < 3; i++) partial.step(false, true);
  partial.step(true); for (let i = 0; i < 2; i++) partial.step();
  expect(partial.shots).toEqual([]); partial.step(); expect(partial.shots).toEqual([7]);
  const cancelled = rig(); cancelled.step(true); for (let i = 0; i < 10; i++) cancelled.step(false, false, false);
  expect(cancelled.shots).toEqual([]);
  const npc = rig(2); npc.step(true); expect(npc.shots).toEqual([1]);
});

test('@E05 @gun-raise switching to the bat during preparation cancels without consuming pistol ammunition', () => {
  const loadout = new Loadout(['weapon.pistol'], ['weapon.bat']), runner = new ActionRunner(1, loadout);
  const shots: number[] = [], started = () => {}, resolve = () => shots.push(1);
  runner.update({ ...emptyInput(), aim: { x: 1, z: 0 }, left: { down: true, held: false, up: false } }, 1, true, started, resolve);
  expect(loadout.current('LEFT').magazine).toBe(6);
  loadout.state.selectedSide = 'RIGHT';
  runner.update({ ...emptyInput(), selectedSlot: { side: 'RIGHT', index: 0 } }, 2, true, started, resolve);
  for (let tick = 3; tick < 12; tick++) runner.update(emptyInput(), tick, true, started, resolve);
  expect(shots).toEqual([]); expect(loadout.current('LEFT').magazine).toBe(6);
});

test('@E05 @gun-raise automatic target-side intent does not cancel the accepted gun tap', () => {
  const r = rig(); r.step(true);
  r.runner.loadout.state.selectedSide = 'RIGHT';
  for (let tick = 2; tick <= 7; tick++) r.runner.update({ ...emptyInput(), selectorSide: 'RIGHT' }, tick, true, () => {}, a => r.shots.push(a.activeAt));
  expect(r.shots).toEqual([7]);
});
