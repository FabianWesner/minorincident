import { expect, test, vi } from 'vitest';
import { Wheel } from '../../../src/input/devices/Wheel';

test('T-E03-wheel @E03 @E03-AC03 trackpad threshold and exact 120ms debounce preserve wheel directions', () => {
  let time = 0; vi.spyOn(performance, 'now').mockImplementation(() => time);
  const target = new EventTarget(); const pulses: number[] = [];
  const wheel = new Wheel(target as unknown as HTMLElement, (direction) => pulses.push(direction)); wheel.init();
  const roll = (deltaY: number, deltaMode = 0): void => { const event = new Event('wheel', { cancelable: true }); Object.assign(event, { deltaY, deltaMode }); target.dispatchEvent(event); expect(event.defaultPrevented).toBe(true); };
  roll(1); roll(1); roll(2); expect(pulses).toEqual([1]);
  time = 119; roll(-8); expect(pulses).toEqual([1]);
  time = 120; roll(-8); expect(pulses).toEqual([1, -1]);
  roll(100); roll(100); roll(-100); roll(1, 1); expect(pulses).toEqual([1, -1, 1, 1, -1, 1]);
  wheel.dispose();
});
