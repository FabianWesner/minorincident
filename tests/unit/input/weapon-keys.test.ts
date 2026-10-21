import { expect, test } from 'vitest';
import { weaponKey, weaponKeys } from '../../../src/data/weaponKeys';
import { ActionRunner } from '../../../src/sim/combat/ActionRunner';
import { Loadout } from '../../../src/sim/combat/Loadout';
import { emptyInput } from '../../../src/input/InputFrame';
import { Bindings, bindingStorageKey } from '../../../src/input/Bindings';
import { defaultBindings } from '../../../src/data/bindings';
import { decodeLog, InputLogEncoder } from '../../../src/telemetry/codec';

test('@E03 fixed campaign numbers include aliases and leave other catalog actions unnumbered', () => {
  expect(weaponKeys).toEqual({ 'weapon.fists': 1, 'weapon.bat': 2, 'weapon.fire-axe': 3, 'weapon.handgun': 4, 'weapon.army-mg': 5, 'weapon.shotgun': 6, 'weapon.rocket-launcher': 7, 'weapon.molotov': 8, 'weapon.pipe-bomb': 9 });
  expect(weaponKey('weapon.kick')).toBe(1); expect(weaponKey('weapon.pistol')).toBe(4);
  for (const id of ['weapon.crowbar', 'weapon.rotary-minigun', 'ability.corgi-lure', 'toString']) expect(weaponKey(id)).toBeUndefined();
});

test('@E03 fixed numbers find retained weapons across sides without shifting absent keys or changing timers', () => {
  const l = new Loadout(['weapon.fire-axe', 'weapon.bat'], ['weapon.kick']);
  for (const id of ['weapon.molotov', 'weapon.pipe-bomb', 'weapon.shotgun', 'weapon.pistol']) l.collect('RIGHT', id, true);
  l.state.RIGHT.rack[4].readyAt = 100;
  for (const [key, id, side, tick] of [[2, 'weapon.bat', 'LEFT', 1], [3, 'weapon.fire-axe', 'LEFT', 20], [4, 'weapon.pistol', 'RIGHT', 40], [9, 'weapon.pipe-bomb', 'RIGHT', 60], [1, 'weapon.kick', 'RIGHT', 80]] as const) {
    l.input({ ...emptyInput(), selectedWeaponKey: key }, tick);
    expect(l.state.selectedSide).toBe(side); expect(l.current(side).id).toBe(id);
  }
  expect(l.state.RIGHT.rack[4].readyAt).toBe(100); expect(l.state.RIGHT.swapUntil).toBe(95);
  const before = structuredClone(l.state);
  for (const key of [0, 5, 7, 10, NaN, 2.5]) l.input({ ...emptyInput(), selectedWeaponKey: key }, 100);
  expect(l.state).toEqual(before);
  // The existing swap delay blocks another choice on that rack.
  l.input({ ...emptyInput(), selectedWeaponKey: 6 }, 81); expect(l.current('RIGHT').id).toBe('weapon.kick');
});

test('@E03 unarmed merges kick/fists and Shift retains ordered RIGHT slot semantics', () => {
  const l = new Loadout(['weapon.bat', 'weapon.fists'], ['weapon.fire-axe', 'weapon.kick', 'weapon.handgun']);
  l.input({ ...emptyInput(), selectedWeaponKey: 1 }, 1);
  expect(l.state.selectedSide).toBe('LEFT'); expect(l.current('LEFT').id).toBe('weapon.fists');
  l.input({ ...emptyInput(), selectedSlot: { side: 'RIGHT', index: 1 }, orderedSelection: true }, 30);
  expect(l.state.selectedSide).toBe('RIGHT'); expect(l.current('RIGHT').id).toBe('weapon.fire-axe');
});

test('@E03 all nine digits are reserved including saved bindings', () => {
  const bindings = new Bindings();
  for (let key = 1; key <= 9; key++) expect(bindings.rebind('interact', `Digit${key}`).ok).toBe(false);
  const saved = { ...defaultBindings, interact: ['Mouse1', 'Digit9'] };
  const restored = new Bindings({ getItem: key => key === bindingStorageKey ? JSON.stringify({ version: 1, bindings: saved }) : null, setItem() {} });
  expect(restored.get()).toEqual(defaultBindings);
});

test('@E03 telemetry replays fixed key pulses and their release', () => {
  const chunks: Uint8Array[] = [], encoder = new InputLogEncoder(bytes => chunks.push(bytes));
  encoder.begin({}); encoder.add({ ...emptyInput(), selectedWeaponKey: 9 }, 'keyboard'); encoder.add(emptyInput(), 'keyboard'); encoder.end();
  const decoded = decodeLog(chunks);
  expect(decoded.frames[0].selectedWeaponKey).toBe(9); expect(decoded.frames[1].selectedWeaponKey).toBeUndefined();
});

test('@E03 an absent weapon key leaves a buffered melee attack intact', () => {
  const l = new Loadout(['weapon.bat'], ['weapon.kick']), runner = new ActionRunner(1, l);
  l.current('LEFT').readyAt = 100;
  const frame = emptyInput(); frame.left.down = true;
  runner.update(frame, 1, true, () => {}, () => {});
  const before = runner.snapshotBuffer(); expect(before.LEFT).toBeDefined();
  runner.update({ ...emptyInput(), selectedWeaponKey: 3 }, 2, true, () => {}, () => {});
  expect(runner.snapshotBuffer()).toEqual(before);
});

test('@E03 replay chunks from before fixed weapon keys still decode with no shortcut', () => {
  const chunks: Uint8Array[] = [], encoder = new InputLogEncoder(bytes => chunks.push(bytes));
  encoder.begin({}); encoder.add(emptyInput(), 'keyboard'); encoder.end();
  // A one-frame old MIR1 keyframe ends at slot 20: drop slot 21 and its mask bit.
  const old = chunks[0].slice(0, -1), view = new DataView(old.buffer);
  const maskAt = 13 + 4 + 2 + 1; // header, metadata length, {}, record gap
  view.setUint32(maskAt, view.getUint32(maskAt, true) & ~(1 << 21), true);
  expect(decodeLog([old]).frames).toEqual([emptyInput()]);
});
