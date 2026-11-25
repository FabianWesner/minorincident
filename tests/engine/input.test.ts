// Input mapping: keyboard, mouse and bindings feed one InputFrame used by every level, the bots and replays.
import { afterEach, expect, test, vi } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { Clock } from '../../src/core/Clock';
import { defaultBindings, type Action } from '../../src/data/bindings';
import { catalog, mountedActions } from '../../src/data/actions/catalog';
import { weaponOrder } from '../../src/data/weaponOrder';
import { weaponKey, weaponKeys } from '../../src/data/weaponKeys';
import { levelWeaponSets, weaponKeyOrder, weaponRackSlots } from '../../src/data/weaponSlots';
import { Bindings, bindingStorageKey } from '../../src/input/Bindings';
import { Buttons } from '../../src/input/Buttons';
import { ClickPick } from '../../src/input/ClickPick';
import { Keyboard } from '../../src/input/devices/Keyboard';
import { emptyInput } from '../../src/input/InputFrame';
import { InputSystem } from '../../src/input/InputSystem';
import { Recorder } from '../../src/input/Recorder';
import { Settings } from '../../src/ui/Settings';
import { Loadout } from '../../src/sim/combat/Loadout';
import type { EntitySnapshot } from '../../src/sim/world/types';

afterEach(() => vi.unstubAllGlobals());
function element() {
  return Object.assign(new EventTarget(), {
    dataset: {}, style: {}, textContent: '', hidden: false, setAttribute() {}, append() {}, replaceChildren() {}, focus() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1600, height: 900 }),
  });
}
/** Real keyboard/pointer adapters with a minimal DOM at one camera azimuth. */
function setup(azimuth: number) {
  const target = new EventTarget(), canvas = element();
  vi.stubGlobal('document', { createElement: element });
  vi.stubGlobal('window', target);
  vi.stubGlobal('localStorage', { getItem: () => null, setItem() {} });
  vi.stubGlobal('performance', { now: () => 0 });
  const camera = new PerspectiveCamera(25, 1600 / 900, .1, 1000);
  camera.position.set(Math.sin(azimuth) * 34, 29, Math.cos(azimuth) * 34); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const input = new InputSystem(canvas as unknown as HTMLElement, camera);
  input.keyboard.init(); input.pointer.init();
  const send = (where: EventTarget, type: string, fields: Record<string, unknown> = {}) => where.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), fields));
  const screenAngle = (d: { x: number; z: number }) => {
    const a = new Vector3(0, 0, 0).project(camera), b = new Vector3(d.x, 0, d.z).project(camera);
    return Math.atan2((b.y - a.y) * 450, (b.x - a.x) * 800) * 180 / Math.PI;
  };
  return { input, screenAngle, screen: (x: number, y: number, z: number) => { const v = new Vector3(x, y, z).project(camera); return [(v.x + 1) * 800, (1 - v.y) * 450] as const; }, key: (code: string, held: boolean) => send(target, held ? 'keydown' : 'keyup', { code }),
    pointer: (x: number, y: number) => send(canvas, 'pointermove', { pointerType: 'mouse', clientX: x, clientY: y, shiftKey: false }),
    click: (x: number, y: number) => send(canvas, 'mousedown', { button: 0, clientX: x, clientY: y, shiftKey: false }),
    pointerUp: () => send(target, 'mouseup', { button: 0 }),
    sample: (targets: EntitySnapshot[] = []) => structuredClone(input.sample({ x: 0, z: 0 }, 1 / 60, targets)) };
}
const off = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

test('keyboard aim (Q-196): WASD/arrows follow the screen at every camera yaw; keyboard fire ignores a resting cursor', () => {
  for (const azimuth of [0, Math.PI / 4, Math.PI / 2, 3 * Math.PI / 4, Math.PI, -Math.PI / 4, -Math.PI / 2, -3 * Math.PI / 4]) {
    const label = `camera yaw ${(azimuth * 180 / Math.PI).toFixed(0)}°`, c = setup(azimuth);
    for (const [code, screen] of [['KeyD', 0], ['KeyW', 90], ['KeyA', 180], ['KeyS', -90]] as const) {
      c.key(code, true); const frame = c.sample(); c.key(code, false); c.sample();
      expect(off(c.screenAngle(frame.move), screen), `${label} ${code}`).toBeLessThan(1);
    }
    for (const [code, screen] of [['ArrowRight', 0], ['ArrowUp', 90], ['ArrowLeft', 180], ['ArrowDown', -90]] as const) {
      c.key(code, true); const frame = c.sample(); c.key(code, false); c.sample();
      expect(off(c.screenAngle(frame.move), screen), `${label} ${code}`).toBeLessThan(1);
    }
    c.pointer(1400, 150); c.sample();
    c.key('KeyD', true);
    expect(c.sample().aimSource, label).toBe('assist'); // Walking faces the move direction until an attack starts
    for (const code of ['KeyK', 'KeyJ', 'Space']) {
      c.key(code, true);
      const firing = c.sample();
      expect(firing.aimSource, `${label} ${code}`).toBe('assist'); expect(firing.aim).toBeNull();
      c.key(code, false); c.sample();
    }
    c.key('KeyD', false); c.sample(); c.pointer(1401, 150);
    expect(c.sample().aimSource, label).toBe('assist');
    vi.unstubAllGlobals();
  }
  const c = setup(0);
  c.pointer(1100, 430); c.click(1100, 430);
  expect(c.sample().moveTarget).toBeUndefined(); c.pointerUp();
  c.key('KeyA', true); c.pointer(1100, 430); c.click(1100, 430);
  c.input.recorder.start({ level: 'L1', seed: 1 });
  const click = c.sample();
  expect(click.moveTarget).toBeUndefined(); expect(click.pointerGround).toBeUndefined();
  expect(click.mouseAttack).toBe(true); expect(click.aimSource).toBe('pointer'); expect(click.aimPoint).toBeTruthy();
  expect(click.move.x).toBeLessThan(0); expect(click.aim!.x).toBeGreaterThan(0);
  expect(click.left.down).toBe(true); expect(click.left.held).toBe(true); expect(click.strafe).toBe(true);
  c.pointer(500, 430); const held = c.sample();
  expect(held.left.held).toBe(true); expect(held.aim!.x).toBeLessThan(0); expect(held.moveTarget).toBeUndefined();
  const target = { id: 3, faction: 'infected', archetype: 'infected.runner', transform: { x: 4, y: .7, z: -2, yaw: 0 }, health: { current: 40, max: 40 } } as EntitySnapshot;
  c.pointer(...c.screen(4, 1.4, -2)); const exact = c.sample([target]);
  expect(exact.aimPoint).toEqual({ x: 4, z: -2 }); expect(exact.attackTarget).toBeUndefined(); expect(exact.moveTarget).toBeUndefined();
  c.pointerUp();
  c.key('Space', true); const space = c.sample();
  expect(space.activeAttack).toBe(true); expect(space.aimSource).toBe('assist'); expect(space.aim).toBeNull(); expect(space.move.x).toBeLessThan(0);
  c.key('KeyG', true); expect(c.sample().corgiLure).toBe(true); c.key('KeyG', false); expect(c.sample().corgiLure).toBeUndefined();
  // PO 2026-11-22: Q flips to the last-used weapon; Shift+Q rolls through the whole list.
  c.key('KeyQ', true); const swap = c.sample(); expect(swap.swapLast).toBe(true); expect(swap.selector).toBe(0); c.key('KeyQ', false);
  c.key('ShiftLeft', true); c.key('KeyQ', true); const roll = c.sample();
  expect(roll.selector).toBe(1); expect(roll.selectorActive).toBe(true); expect(roll.swapLast).toBeUndefined();
  c.key('KeyQ', false); c.key('ShiftLeft', false);
  c.pointer(1200, 350); expect(c.sample().aimSource).toBe('assist');
  const recording = Recorder.parse(Recorder.serialize(c.input.recorder.stop()));
  const legacy = Recorder.parse(JSON.stringify({ ...recording, frames: [{ ...recording.frames[0], moveTarget: { x: 20, z: 20 }, attackTarget: { id: 3, side: 'LEFT' }, attackInPlace: true, pointerGround: true, pointerTarget: true }] }));
  for (const key of ['moveTarget', 'attackTarget', 'attackInPlace', 'pointerGround', 'pointerTarget']) expect(legacy.frames[0]).not.toHaveProperty(key);
  c.input.recorder.play(recording);
  for (const frame of recording.frames) expect(c.sample()).toEqual(frame);
  c.input.recorder.reset(); c.pointer(1100, 430); c.click(1100, 430); expect(c.sample().moveTarget).toBeUndefined();
  c.key('ArrowUp', true); c.key('ArrowUp', false); c.sample();
  c.key('Space', true); expect(c.sample().left.held).toBe(true); c.key('Space', false);
  c.key('ArrowRight', true); expect(c.sample().move).toBeTruthy(); c.key('ArrowRight', false);
  c.input.release(); c.input.setDriving(true); c.pointer(1100, 430); c.click(1100, 430);
  const driving = c.sample();
  expect(c.input.scheme).toBe('mouse-only'); expect(driving.drive).toBeUndefined(); expect(driving.strafe).toBeUndefined(); expect(driving.left.held).toBe(true);
  c.pointerUp(); c.input.setDriving(false);
  // Vehicle-relative car keys (PO 2026-11-10), independent of the camera azimuth: W gas, S brake/reverse, A = vehicle left (+steer), D = right.
  c.input.release(); c.input.setDriving(true);
  for (const [code, throttle, steer] of [['KeyW', 1, 0], ['KeyS', -1, 0], ['KeyA', 0, 1], ['KeyD', 0, -1], ['ArrowUp', 1, 0], ['ArrowDown', -1, 0], ['ArrowLeft', 0, 1], ['ArrowRight', 0, -1]] as const) {
    c.key(code, true); const f = c.sample();
    expect([f.drive?.throttle, f.drive?.steer], code).toEqual([throttle || 0, steer || 0]);
    c.key(code, false); c.sample();
  }
  c.input.setDriving(false);
  let saved = JSON.stringify({ controlMode: 'classic' });
  const storage = { getItem: () => saved, setItem: (_: string, value: string) => { saved = value; } };
  const settings = new Settings(storage); expect('controlMode' in settings.value).toBe(false);
  settings.patch({ controlMode: 'classic' } as never); expect(new Settings(storage).value).toEqual(settings.value);
  vi.unstubAllGlobals();
});

test('buttons: a key event reaches the next tick, sources combine, pause release fires once', () => {
  const target = new EventTarget(), buttons = new Buttons();
  const keyboard = new Keyboard(target, (code, held) => { if (code === 'KeyJ') buttons.set(code, held); });
  keyboard.init();
  const frame = emptyInput(), clock = new Clock();
  const nextTick = () => { clock.advance(1 / 60, () => { frame.left = buttons.sample(); }); return structuredClone(frame.left); };
  const dispatch = (type: string) => target.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), { code: 'KeyJ', repeat: false }));
  expect(nextTick()).toEqual({ down: false, held: false, up: false });
  dispatch('keydown'); expect(nextTick()).toEqual({ down: true, held: true, up: false });
  dispatch('keydown'); expect(nextTick()).toEqual({ down: false, held: true, up: false });
  dispatch('keyup'); expect(nextTick()).toEqual({ down: false, held: false, up: true });
  dispatch('keydown'); dispatch('keyup'); expect(nextTick()).toEqual({ down: true, held: false, up: true });
  keyboard.dispose(); dispatch('keydown'); expect(nextTick().held).toBe(false);

  const combined = new Buttons();
  combined.set('KeyJ', true); combined.set('Mouse0', true); combined.sample();
  combined.set('KeyJ', false); expect(combined.sample()).toEqual({ down: false, held: true, up: false });
  combined.release(); combined.reset(true); combined.release(); combined.reset(true);
  expect(combined.sample()).toEqual({ down: false, held: false, up: true });
});

test('bindings: every action rebinds and persists without conflicts; broken or blocked storage keeps defaults; old maps migrate', () => {
  const entries = new Map<string, string>();
  const storage = { getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => { entries.set(key, value); } };
  const bindings = new Bindings(storage);
  for (const [index, action] of (Object.keys(defaultBindings) as Action[]).entries()) {
    const code = index < 12 ? `F${index + 1}` : ['KeyZ', 'KeyX', 'KeyV', 'KeyB'][index - 12];
    expect(bindings.rebind(action, code).ok, action).toBe(true);
    expect(new Bindings(storage).action(code)).toBe(action);
  }
  expect(bindings.rebind('right', 'F1')).toEqual({ ok: false, message: 'F1 is already bound to moveUp.' });
  entries.set(bindingStorageKey, '{broken'); expect(new Bindings(storage).get()).toEqual(defaultBindings);
  const blocked = new Bindings({ getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } });
  expect(blocked.get()).toEqual(defaultBindings);
  expect(blocked.rebind('left', 'KeyZ')).toEqual({ ok: false, message: 'Bindings could not be saved.' });
  const old = { ...defaultBindings, right: ['Mouse2', 'KeyK'], selector: ['KeyQ', 'KeyL'] };
  const migrated = new Bindings({ getItem: () => JSON.stringify({ version: 1, bindings: old }), setItem() {} });
  expect(migrated.action('Mouse2')).toBe('selector'); expect(migrated.action('KeyK')).toBe('right');
  expect(migrated.action('KeyQ')).toBeNull(); expect(migrated.action('KeyL')).toBe('selector');
  expect(migrated.rebind('selector', 'KeyQ').ok).toBe(false);
  const custom = { ...defaultBindings, moveUp: ['KeyG'], selector: ['KeyQ'] };
  const migratedCustom = new Bindings({ getItem: () => JSON.stringify({ version: 1, bindings: custom }), setItem() {} });
  expect(migratedCustom.action('KeyG')).toBeNull(); expect(migratedCustom.action('KeyQ')).toBeNull();
  expect(migratedCustom.get().moveUp.length).toBeGreaterThan(0); expect(migratedCustom.action('Mouse2')).toBe('selector');
});

test('weapon selection: one fixed order drives number keys, cycling and touch slots, and survives a rack rebuild', () => {
  expect(new Set(weaponOrder).size).toBe(weaponOrder.length);
  expect([...Object.keys(catalog), ...Object.keys(mountedActions)].filter(id => id !== 'weapon.flashbang' && !(weaponOrder as readonly string[]).includes(id))).toEqual([]);
  const left = ['weapon.fire-axe', 'weapon.bat', 'weapon.kick'], right = ['ability.corgi-lure', 'weapon.molotov', 'weapon.handgun'];
  const loadout = new Loadout(left, right);
  const expected = ['weapon.fire-axe', 'weapon.bat', 'weapon.handgun', 'weapon.molotov'];
  expect(loadout.activeEntries().map(e => e.id)).toEqual(expected);
  expect(loadout.orderedEntries('RIGHT').map(e => e.id)).toEqual(['weapon.handgun', 'weapon.molotov']);
  const ordered = new Loadout(['weapon.bat'], ['weapon.nail-gun', 'weapon.army-mg', 'weapon.shotgun']);
  expect(ordered.orderedEntries('RIGHT').map(entry => entry.id)).toEqual(['weapon.shotgun', 'weapon.army-mg', 'weapon.nail-gun']);
  const lureOnly = new Loadout(['weapon.fire-axe'], ['ability.corgi-lure']);
  lureOnly.input({ ...emptyInput(), selectorSide: 'RIGHT', selector: 1 }, 30);
  expect(lureOnly.current('RIGHT').id).toBe('weapon.fists');
  for (let index = 0; index < expected.length; index++) {
    loadout.input({ ...emptyInput(), selectedActiveSlot: index }, 30 * index + 30);
    const id = loadout.current(loadout.state.selectedSide).id;
    expect(id === 'weapon.kick' ? 'weapon.fists' : id).toBe(expected[index]);
  }
  loadout.input({ ...emptyInput(), selectedSlot: { side: 'LEFT', index: 0 }, orderedSelection: true }, 240);
  expect(loadout.current('LEFT').id).toBe('weapon.kick');
  loadout.input({ ...emptyInput(), selectorSide: 'LEFT', selector: 1 }, 270);
  expect(loadout.current('LEFT').id).toBe('weapon.bat');
  const rebuilt = new Loadout(loadout.state.LEFT.rack.map(s => s.id), loadout.state.RIGHT.rack.map(s => s.id));
  expect(rebuilt.activeEntries().map(e => e.id)).toEqual(expected);
  // HUD slot click: same frame field as the number key, only where number keys work, never a shot, move or aim.
  const c = setup(0);
  c.key('Digit2', true); c.key('Digit2', false);
  const viaKey = c.sample();
  expect(c.input.selectWeaponKey(2)).toBe(true);
  const viaClick = c.sample();
  expect(viaClick.selectedWeaponKey).toBe(2); expect(viaClick.selectedWeaponKey).toBe(viaKey.selectedWeaponKey);
  expect(viaClick.left.down || viaClick.right.down || viaClick.moveTarget || viaClick.mouseAttack || viaClick.aimPoint).toBeFalsy();
  expect(c.sample().selectedWeaponKey).toBeUndefined();
  expect(c.input.selectWeaponKey(0)).toBe(false); expect(c.input.selectWeaponKey(10)).toBe(true);
  c.input.clear(); c.key('Digit0', true); c.key('Digit0', false); expect(c.sample().selectedWeaponKey).toBe(10);
  c.input.setDriving(true); expect(c.input.selectWeaponKey(3)).toBe(false); expect(c.sample().selectedWeaponKey).toBeUndefined();
  c.key('ShiftLeft', true); c.key('Digit1', true); c.key('KeyQ', true); c.key('KeyG', true);
  const driving = c.sample(); expect(driving.selectedSlot).toBeUndefined(); expect(driving.selectedWeaponKey).toBeUndefined(); expect(driving.selector).toBe(0); expect(driving.corgiLure).toBeUndefined();
  for (const code of ['ShiftLeft', 'Digit1', 'KeyQ', 'KeyG']) c.key(code, false);
  c.input.setDriving(false); c.input.setMountedGun(true); c.key('Digit1', true); c.key('KeyQ', true); c.key('KeyG', true);
  const mounted = c.sample(); expect(mounted.selectedWeaponKey).toBeUndefined(); expect(mounted.selector).toBe(0); expect(mounted.corgiLure).toBeUndefined();
  for (const code of ['Digit1', 'KeyQ', 'KeyG']) c.key(code, false);
  c.input.setMountedGun(false); c.key('ShiftLeft', true); c.key('Digit1', true); expect(c.sample().selectedWeaponKey).toBe(1);

  const ids = Object.keys(catalog).filter(id => id.startsWith('weapon.') && id !== 'weapon.kick' && id !== 'weapon.pistol');
  expect(Object.keys(weaponKeys)).toContain('weapon.nail-gun');
  expect(weaponKey('weapon.nail-gun')).toBe(7);
  expect(weaponKey('weapon.army-mg')).toBe(4);
  expect(weaponKey('weapon.bat')).toBe(1);
  expect(weaponKey('weapon.molotov')).toBe(10);
  expect(weaponKey('weapon.pipe-bomb')).toBe(10);
  expect(new Set(ids.map(id => weaponKey(id)).filter(key => key !== undefined)).size).toBeLessThan(ids.length);
  const sparse = new Loadout(['weapon.fire-axe', 'weapon.machete'], ['weapon.handgun']);
  expect(sparse.activeEntries().map(e => e.id)).toEqual(['weapon.fire-axe', 'weapon.machete', 'weapon.handgun']);
  sparse.input({ ...emptyInput(), selectedWeaponKey: 2 }, 30);
  expect(sparse.current(sparse.state.selectedSide).id).toBe('weapon.handgun');
  sparse.input({ ...emptyInput(), selectedWeaponKey: 1 }, 60);
  expect(sparse.current(sparse.state.selectedSide).id).toBe('weapon.fire-axe');
  sparse.input({ ...emptyInput(), selectedWeaponKey: 1 }, 90);
  expect(sparse.current(sparse.state.selectedSide).id).toBe('weapon.machete');
  const thrown = new Loadout(['weapon.fire-axe'], ['weapon.molotov', 'weapon.pipe-bomb']);
  thrown.input({ ...emptyInput(), selectedWeaponKey: 10 }, 30);
  const firstThrown = thrown.current(thrown.state.selectedSide).id;
  thrown.input({ ...emptyInput(), selectedWeaponKey: 10 }, 60);
  expect(new Set([firstThrown, thrown.current(thrown.state.selectedSide).id])).toEqual(new Set(['weapon.molotov', 'weapon.pipe-bomb']));
  const recorded = { seed: 1, level: 'L10', frames: [{ ...emptyInput(), selectedWeaponKey: 3 }] };
  const legacyRecording = Recorder.parse(JSON.stringify({ ...recorded, version: 1 }));
  const legacyRack = new Loadout(['weapon.fire-axe', 'weapon.machete'], ['weapon.handgun']);
  legacyRack.input(legacyRecording.frames[0], 30);
  expect(legacyRack.current(legacyRack.state.selectedSide).id).toBe('weapon.fire-axe');
  legacyRack.input({ ...emptyInput(), selectedLegacyWeaponKey: 1 }, 60);
  expect(legacyRack.current(legacyRack.state.selectedSide).id).toBe('weapon.fists');
  const currentRecording = Recorder.parse(JSON.stringify({ ...recorded, version: 2 }));
  const currentRack = new Loadout(['weapon.fire-axe', 'weapon.machete'], ['weapon.handgun']);
  currentRack.input(currentRecording.frames[0], 30);
  expect(currentRack.current(currentRack.state.selectedSide).id).toBe('weapon.handgun'); // historical rack position 3
  const fixedRecording = Recorder.parse(JSON.stringify({ ...recorded, version: 3 }));
  const fixedRack = new Loadout(['weapon.fire-axe', 'weapon.machete'], ['weapon.handgun']);
  fixedRack.input(fixedRecording.frames[0], 30);
  expect(fixedRack.current(fixedRack.state.selectedSide).id).toBe('weapon.fire-axe'); // fixed key 3 is a hole
  const legacyCycle = new Loadout(['weapon.fire-axe'], ['weapon.army-mg', 'weapon.shotgun']);
  legacyCycle.input({ ...emptyInput(), selectedPositionWeaponKey: 2, legacyWeaponOrder: true }, 30);
  expect(legacyCycle.current(legacyCycle.state.selectedSide).id).toBe('weapon.army-mg');
  legacyCycle.input({ ...emptyInput(), selector: 1, selectorActive: true, legacyWeaponOrder: true }, 60);
  expect(legacyCycle.current(legacyCycle.state.selectedSide).id).toBe('weapon.shotgun');
  legacyCycle.input({ ...emptyInput(), selectedSlot: { side: 'RIGHT', index: 0 }, orderedSelection: true, legacyWeaponOrder: true }, 90);
  expect(legacyCycle.current('RIGHT').id).toBe('weapon.army-mg');
  const pickups = new Loadout(['weapon.fire-axe', 'weapon.nail-gun', 'weapon.army-mg'], ['weapon.handgun']);
  pickups.input({ ...emptyInput(), selectedWeaponKey: 7 }, 30);
  expect(pickups.current(pickups.state.selectedSide).id).toBe('weapon.nail-gun');
  pickups.input({ ...emptyInput(), selectedWeaponKey: 4 }, 60);
  expect(pickups.current(pickups.state.selectedSide).id).toBe('weapon.army-mg');
  expect(weaponKey(pickups.current(pickups.state.selectedSide).id)).toBe(4);
  expect(weaponKey('weapon.nail-gun')).toBe(7);
  const cycle = new Loadout(ids.slice(0, 3), ids.slice(3, 6));
  const entries = cycle.activeEntries();
  const currentId = cycle.current(cycle.state.selectedSide).id;
  let entryIndex = entries.findIndex(entry => entry.id === (currentId === 'weapon.kick' ? 'weapon.fists' : currentId));
  let tick = 30;
  for (let index = 0; index < entries.length; index++) {
    cycle.input({ ...emptyInput(), selector: 1, selectorActive: true }, tick);
    tick += 30;
    entryIndex = (entryIndex + 1) % entries.length;
    const selected = cycle.current(cycle.state.selectedSide).id;
    expect(selected === 'weapon.kick' ? 'weapon.fists' : selected).toBe(entries[entryIndex].id);
  }
  expect(weaponKey('weapon.kick')).toBe(weaponKey('weapon.fists'));
  expect(weaponKey('weapon.pistol')).toBe(weaponKey('weapon.handgun'));
  for (const weapons of Object.values(levelWeaponSets)) {
    const keys = [...new Set(weapons.map(weaponKey).filter((key): key is number => key !== undefined))];
    expect(keys).toEqual([...keys].sort((a, b) => a - b));
    expect(keys.every(key => weaponKeyOrder.includes(key as typeof weaponKeyOrder[number]))).toBe(true);
  }
  for (const level of Object.keys(levelWeaponSets).map(Number) as (keyof typeof levelWeaponSets)[]) {
    const slots = weaponRackSlots(level, []);
    expect(slots.map(slot => slot.key)).toEqual([...slots.map(slot => slot.key)].sort((a, b) => a - b));
    expect(slots.every(slot => !slot.owned)).toBe(true);
    expect(weaponRackSlots(level, levelWeaponSets[level]).every(slot => slot.owned)).toBe(true);
  }
  const expectedLevelKeys = [[1], [1], [1, 2], [1, 2, 4], [1, 2, 3, 4, 5], [1, 2, 3, 4], [1, 2, 3, 4, 5, 9], [1, 2, 3, 4, 9], [1, 2, 5], [1, 2, 3, 5, 6, 7, 8, 9, 10]];
  expectedLevelKeys.forEach((keys, index) => {
    const level = (index + 1) as keyof typeof levelWeaponSets;
    const holes = weaponRackSlots(level, []);
    expect(holes.map(slot => slot.key), `L${level} fixed slots`).toEqual(keys);
    for (const key of keys) {
      const found = levelWeaponSets[level].find(id => weaponKey(id) === key)!;
      const acquired = weaponRackSlots(level, [found]);
      expect(acquired.map(slot => slot.key)).toEqual(keys);
      expect(acquired.filter(slot => slot.owned).map(slot => slot.key)).toEqual([key]);
    }
  });
});

test('click pick: head-to-feet body capsule picks the infected; downed stay pickable; corpses, hidden and civilians never', () => {
  const camera = new PerspectiveCamera(25, 16 / 9, .1, 600);
  camera.position.setFromSphericalCoords(19, Math.PI * .3, Math.PI / 4); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
  const picker = new ClickPick(camera, { getBoundingClientRect: () => ({ left: 0, top: 0, width: 1600, height: 900 }) } as unknown as HTMLElement);
  const screen = (x: number, y: number, z: number) => { const p = new Vector3(x, y, z).project(camera); return [(p.x + 1) * 800, (1 - p.y) * 450] as const; };
  const infected = (id: number, x: number, z: number, hp = 40, extra: Partial<EntitySnapshot> = {}) => ({ id, faction: 'infected', archetype: 'infected.runner', transform: { x, y: .7, z, yaw: 0 }, health: { current: hp, max: 40 }, infected: { hidden: false, recoverAt: hp > 0 ? -1 : 900 }, ...extra }) as unknown as EntitySnapshot;
  const target = infected(2, 1.2, 0);
  for (const y of [0, .9, 1.25, 1.65, 1.75]) expect(picker.pick(...screen(1.2, y, 0), [target])?.id, `height ${y}`).toBe(2);
  expect(picker.pick(...screen(1.2, 1.2, .9), [target])).toBeNull();
  const lying = infected(3, 1, 1, 0), at = screen(1, .15, 1);
  expect(picker.pick(...at, [lying])?.id).toBe(3);
  expect(picker.pick(...at, [{ ...lying, corpse: true } as unknown as EntitySnapshot])).toBeNull();
  expect(picker.pick(...screen(1.2, 1.25, 0), [infected(4, 1.2, 0, 40, { hidden: true })])).toBeNull();
  expect(picker.pick(...screen(1.2, 1.25, 0), [{ ...infected(5, 1.2, 0), faction: 'civilian' } as unknown as EntitySnapshot])).toBeNull();
});
