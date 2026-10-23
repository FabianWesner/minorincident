import { expect, test } from 'vitest';
import { VehicleRecovery } from '../../tools/playtest/driving';

test('a car blocked for three seconds reverses, then retries forward and alternates its escape turn', () => {
  const recovery = new VehicleRecovery(), car = { x: 402, z: -16.8 };
  expect(recovery.keys(car, 0)).toBeNull();
  expect(recovery.keys(car, 2999)).toBeNull();
  expect(recovery.keys(car, 3000)).toEqual(['KeyS', 'KeyA']);
  expect(recovery.keys(car, 4300)).toEqual(['KeyS', 'KeyA']);
  expect(recovery.keys(car, 4400)).toBeNull();
  expect(recovery.keys(car, 7400)).toEqual(['KeyS', 'KeyD']);
});

test('visible travel resets the stall clock while tiny collision jitter does not', () => {
  const recovery = new VehicleRecovery();
  expect(recovery.keys({ x: 0, z: 0 }, 0)).toBeNull();
  expect(recovery.keys({ x: 1, z: 0 }, 2900)).toBeNull();
  expect(recovery.keys({ x: 1.1, z: 0 }, 5800)).toBeNull();
  expect(recovery.keys({ x: 1, z: 0 }, 5900)).toEqual(['KeyS', 'KeyA']);
});
