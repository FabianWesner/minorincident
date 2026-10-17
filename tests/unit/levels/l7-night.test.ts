import { expect, test } from 'vitest';
import { compositions } from '../../../src/levels/compositions';
import { timeOfDay } from '../../../src/data/timeOfDay';

test('T-E29-14-night @E29-AC14 Northgate uses the identical night lighting across the L6/L7 handover', () => {
  const preset = compositions.L7.timeOfDay;
  expect(preset).toBe('L6');
  const night = timeOfDay[preset!];
  expect(night.intensity).toBeLessThanOrEqual(timeOfDay.L4.intensity * .4);
  expect(night.sun).toBe(timeOfDay.L6.sun);
  expect(night.practical).toBe(1);
  expect(night.aura).toBeGreaterThan(0);
});
