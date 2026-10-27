// Input mapping: keyboard, mouse and bindings feed one InputFrame used by every level, the bots and replays.
import { afterEach, expect, test, vi } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { Clock } from '../../src/core/Clock';
import { defaultBindings, type Action } from '../../src/data/bindings';
import { catalog, mountedActions } from '../../src/data/actions/catalog';
import { weaponOrder } from '../../src/data/weaponOrder';
import { Bindings, bindingStorageKey } from '../../src/input/Bindings';
import { Buttons } from '../../src/input/Buttons';
import { ClickPick } from '../../src/input/ClickPick';
import { Keyboard } from '../../src/input/devices/Keyboard';
import { emptyInput } from '../../src/input/InputFrame';
import { InputSystem } from '../../src/input/InputSystem';
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
  return { screenAngle, key: (code: string, held: boolean) => send(target, held ? 'keydown' : 'keyup', { code }),
    pointer: (x: number, y: number) => send(canvas, 'pointermove', { pointerType: 'mouse', clientX: x, clientY: y, shiftKey: false }),
    sample: () => structuredClone(input.sample({ x: 0, z: 0 })) };
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
      c.key(code, true); c.key(code, false); const frame = c.sample();
      expect(frame.aimSource).toBe('keyboard');
      expect(off(c.screenAngle(frame.aim!), screen), `${label} ${code}`).toBeLessThan(1);
    }
    c.pointer(1400, 150); c.sample();
    c.key('KeyD', true);
    expect(c.sample().aimSource, label).toBe('pointer'); // WASD + cursor twin-stick
    for (const code of ['KeyK', 'KeyJ', 'Space']) {
      c.key(code, true);
      const firing = c.sample();
      expect(firing.aimSource, `${label} ${code}`).toBe('assist'); expect(firing.aim).toBeNull();
      c.key(code, false); c.sample();
    }
    c.key('KeyD', false); c.sample(); c.pointer(1401, 150);
    expect(c.sample().aimSource, label).toBe('pointer');
    vi.unstubAllGlobals();
  }
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
});

test('weapon selection: one fixed order drives number keys, cycling and touch slots, and survives a rack rebuild', () => {
  expect(new Set(weaponOrder).size).toBe(weaponOrder.length);
  expect([...Object.keys(catalog), ...Object.keys(mountedActions)].filter(id => !(weaponOrder as readonly string[]).includes(id))).toEqual([]);
  const left = ['weapon.fire-axe', 'weapon.bat', 'weapon.kick'], right = ['ability.corgi-lure', 'weapon.molotov', 'weapon.handgun'];
  const loadout = new Loadout(left, right);
  const expected = ['weapon.fists', 'weapon.bat', 'weapon.fire-axe', 'weapon.handgun', 'weapon.molotov', 'ability.corgi-lure'];
  expect(loadout.activeEntries().map(e => e.id)).toEqual(expected);
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
