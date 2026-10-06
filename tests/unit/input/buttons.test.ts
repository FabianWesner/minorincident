import { expect, test } from 'vitest';
import { Buttons } from '../../../src/input/Buttons';
import { Clock } from '../../../src/core/Clock';
import { emptyInput } from '../../../src/input/InputFrame';
import { Keyboard } from '../../../src/input/devices/Keyboard';

test('T-E03-11 @E03 @E03-AC11 a real key event reaches the next sampled tick', () => {
  const target = new EventTarget();
  const buttons = new Buttons();
  const keyboard = new Keyboard(target, (code, held) => { if (code === 'KeyJ') buttons.set(code, held); });
  keyboard.init();
  const frame = emptyInput(); const clock = new Clock();
  const nextTick = () => { clock.advance(1 / 60, () => { frame.left = buttons.sample(); }); return structuredClone(frame.left); };
  const dispatch = (type: string): void => {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, { code: 'KeyJ', repeat: false });
    target.dispatchEvent(event);
  };
  expect(nextTick()).toEqual({ down: false, held: false, up: false });
  dispatch('keydown');
  expect(nextTick()).toEqual({ down: true, held: true, up: false });
  dispatch('keydown');
  expect(nextTick()).toEqual({ down: false, held: true, up: false });
  dispatch('keyup');
  expect(nextTick()).toEqual({ down: false, held: false, up: true });
  dispatch('keydown'); dispatch('keyup');
  expect(nextTick()).toEqual({ down: true, held: false, up: true });
  keyboard.dispose(); dispatch('keydown');
  expect(nextTick().held).toBe(false);
});

test('T-E03-buttons @E03 sources combine without releasing another held binding', () => {
  const buttons = new Buttons();
  buttons.set('KeyJ', true); buttons.set('Mouse0', true); buttons.sample();
  buttons.set('KeyJ', false);
  expect(buttons.sample()).toEqual({ down: false, held: true, up: false });
  buttons.release();
  expect(buttons.sample()).toEqual({ down: false, held: false, up: true });
});

test('T-E03-pause-clear @E03 @E03-AC13 repeated pause cleanup preserves one release; level reset stays neutral', () => {
  const buttons = new Buttons();
  buttons.set('Mouse0', true); buttons.sample();
  buttons.release(); buttons.reset(true); buttons.release(); buttons.reset(true);
  expect(buttons.sample()).toEqual({ down: false, held: false, up: true });
  expect(buttons.sample()).toEqual({ down: false, held: false, up: false });
  buttons.set('Mouse0', true); buttons.reset();
  expect(buttons.sample()).toEqual({ down: false, held: false, up: false });
});
