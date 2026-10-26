import { afterEach, expect, test, vi } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { InputSystem } from '../../../src/input/InputSystem';

// Q-196 (PO 10-26): "When I play with keyboard ... the heroine is shooting somewhere else, not to the Zombies. Like 45 degree
// to the other direction". Real keyboard/pointer adapters with a minimal DOM, at every camera yaw.
function element() {
  return Object.assign(new EventTarget(), {
    dataset: {}, style: {}, textContent: '', hidden: false,
    setAttribute() {}, append() {}, replaceChildren() {}, focus() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1600, height: 900 }),
  });
}
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
  const send = (where: EventTarget, type: string, fields: Record<string, unknown> = {}) =>
    where.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), fields));
  /** Screen-space angle (y up) of a ground direction leaving the origin, as the player sees it. */
  const screenAngle = (d: { x: number; z: number }) => {
    const a = new Vector3(0, 0, 0).project(camera), b = new Vector3(d.x, 0, d.z).project(camera);
    return Math.atan2((b.y - a.y) * 450, (b.x - a.x) * 800) * 180 / Math.PI;
  };
  return { input, screenAngle, key: (code: string, held: boolean) => send(target, held ? 'keydown' : 'keyup', { code }),
    pointer: (x: number, y: number) => send(canvas, 'pointermove', { pointerType: 'mouse', clientX: x, clientY: y, shiftKey: false }),
    sample: () => structuredClone(input.sample({ x: 0, z: 0 })) };
}
afterEach(() => vi.unstubAllGlobals());
const off = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

for (const azimuth of [0, Math.PI / 4, Math.PI / 2, 3 * Math.PI / 4, Math.PI, -Math.PI / 4, -Math.PI / 2, -3 * Math.PI / 4]) {
  const label = `${(azimuth * 180 / Math.PI).toFixed(0)}°`;
  test(`Q-196 @E03-AC04 WASD and arrow aim follow the screen at camera yaw ${label}`, () => {
    const c = setup(azimuth);
    for (const [code, screen] of [['KeyD', 0], ['KeyW', 90], ['KeyA', 180], ['KeyS', -90]] as const) {
      c.key(code, true); const frame = c.sample(); c.key(code, false); c.sample();
      expect(off(c.screenAngle(frame.move), screen)).toBeLessThan(1);
    }
    for (const [code, screen] of [['ArrowRight', 0], ['ArrowUp', 90], ['ArrowLeft', 180], ['ArrowDown', -90]] as const) {
      c.key(code, true); c.key(code, false); const frame = c.sample(); // a tap snaps
      expect(frame.aimSource).toBe('keyboard');
      expect(off(c.screenAngle(frame.aim!), screen)).toBeLessThan(1);
    }
  });
  test(`Q-196 @E03-AC05 keyboard fire ignores a resting cursor at camera yaw ${label}`, () => {
    const c = setup(azimuth);
    c.pointer(1400, 150); c.sample(); // a menu click or a nudge left the cursor up-right of the courier
    c.key('KeyD', true);
    const walking = c.sample();
    expect(walking.aimSource).toBe('pointer'); // WASD + cursor twin-stick still aims with the mouse
    for (const code of ['KeyK', 'KeyJ', 'Space']) {
      c.key(code, true);
      const firing = c.sample();
      expect(firing.aimSource).toBe('assist'); expect(firing.aim).toBeNull();
      expect(off(c.screenAngle(firing.move), 0)).toBeLessThan(1);
      c.key(code, false); c.sample();
    }
    c.key('KeyD', false); c.sample();
    c.pointer(1401, 150);
    expect(c.sample().aimSource).toBe('pointer'); // touching the mouse brings cursor aim back
  });
}
