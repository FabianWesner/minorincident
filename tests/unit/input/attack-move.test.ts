import { afterEach, expect, test, vi } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { InputSystem } from '../../../src/input/InputSystem';

// Exercise the real keyboard/pointer adapters and ray projection with a minimal DOM.
function element() {
  return Object.assign(new EventTarget(), {
    dataset: {}, style: {}, textContent: '', hidden: false,
    setAttribute() {}, append() {}, replaceChildren() {}, focus() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1600, height: 900 }),
  });
}
function setup() {
  const target = new EventTarget(), canvas = element();
  vi.stubGlobal('document', { createElement: element });
  vi.stubGlobal('window', target);
  vi.stubGlobal('localStorage', { getItem: () => null, setItem() {} });
  const camera = new PerspectiveCamera(25, 1600 / 900, .1, 1000);
  camera.position.set(24, 29, 24); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const input = new InputSystem(canvas as unknown as HTMLElement, camera);
  input.keyboard.init(); input.pointer.init();
  const send = (where: EventTarget, type: string, fields: Record<string, unknown> = {}) =>
    where.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), fields));
  const aim = (x: number, z: number) => {
    const ndc = new Vector3(x, 0, z).project(camera);
    send(canvas, 'pointermove', { pointerType: 'mouse', clientX: (ndc.x + 1) * 800, clientY: (1 - ndc.y) * 450, shiftKey: false });
  };
  return { input, aim, key: (code: string, held: boolean) => send(target, held ? 'keydown' : 'keyup', { code }),
    mouse: (held: boolean) => send(held ? canvas : target, held ? 'mousedown' : 'mouseup', { button: 0, shiftKey: false }),
    sample: () => structuredClone(input.sample({ x: 0, z: 0 })) };
}
afterEach(() => vi.unstubAllGlobals());

for (const key of ['Space', 'KeyJ', 'KeyK', 'KeyZ']) {
  test(`Q-152 @E03 @E03-AC14 ${key} hold never turns a released ground click into pointer-follow movement`, () => {
    const controls = setup();
    if (key === 'KeyZ') controls.input.rebind('left', key);
    controls.aim(5, 2); controls.key(key, true); controls.sample();
    controls.mouse(true); controls.mouse(false);
    const clicked = controls.sample();
    expect(clicked.moveTarget!.x).toBeCloseTo(5, 8);
    expect(clicked.moveTarget!.z).toBeCloseTo(2, 8);
    controls.aim(-4, 3);
    const aimed = controls.sample();
    expect(aimed.aimPoint!.x).toBeCloseTo(-4, 8);
    expect(aimed.moveTarget).toBeUndefined();
    expect(aimed.cancelMove).toBe(false);
    controls.mouse(true); controls.mouse(false);
    expect(controls.sample().moveTarget!.x).toBeCloseTo(-4, 8);
  });
}

for (const key of ['Space', 'KeyJ', 'KeyK', 'KeyZ']) test(`Q-152 @E03 @E03-AC14 ${key} with held LMB only aims between fresh clicks`, () => {
  const controls = setup();
  if (key === 'KeyZ') controls.input.rebind('left', key);
  controls.aim(5, 2); controls.mouse(true); controls.sample();
  controls.aim(6, 2);
  expect(controls.sample().moveTarget!.x).toBeCloseTo(6, 8);
  controls.mouse(false); controls.key(key, true); controls.sample();
  controls.aim(5, 2); controls.mouse(true);
  expect(controls.sample().moveTarget!.x).toBeCloseTo(5, 8);
  controls.aim(-4, 3);
  expect(controls.sample().moveTarget).toBeUndefined();
  controls.mouse(false); controls.mouse(true);
  expect(controls.sample().moveTarget!.x).toBeCloseTo(-4, 8);
});
