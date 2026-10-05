import { expect, test } from 'vitest';
import { Buttons } from '../../../src/input/Buttons';
import { Keyboard } from '../../../src/input/devices/Keyboard';

test('T-E03-11 @E03 @E03-AC11 a real key event reaches the next sampled tick', () => {
  const target = new EventTarget();
  const buttons = new Buttons();
  const keyboard = new Keyboard(target, (code, held) => { if (code === 'KeyJ') buttons.set(code, held); });
  keyboard.init();
  const dispatch = (type: string): void => {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, { code: 'KeyJ', repeat: false });
    target.dispatchEvent(event);
  };
  expect(buttons.sample()).toEqual({ down: false, held: false, up: false });
  dispatch('keydown');
  expect(buttons.sample()).toEqual({ down: true, held: true, up: false });
  dispatch('keydown');
  expect(buttons.sample()).toEqual({ down: false, held: true, up: false });
  dispatch('keyup');
  expect(buttons.sample()).toEqual({ down: false, held: false, up: true });
  dispatch('keydown'); dispatch('keyup');
  expect(buttons.sample()).toEqual({ down: true, held: false, up: true });
  keyboard.dispose(); dispatch('keydown');
  expect(buttons.sample().held).toBe(false);
});

test('T-E03-buttons @E03 sources combine without releasing another held binding', () => {
  const buttons = new Buttons();
  buttons.set('KeyJ', true); buttons.set('Mouse0', true); buttons.sample();
  buttons.set('KeyJ', false);
  expect(buttons.sample()).toEqual({ down: false, held: true, up: false });
  buttons.release();
  expect(buttons.sample()).toEqual({ down: false, held: false, up: true });
});
