import { expect, test } from 'vitest';
import { SimWorld } from '../../src/sim/world/SimWorld';

test('infected ignore empty parked cars, cling to occupied cars, and release when the last occupant leaves', async () => {
  const w = new SimWorld(); await w.init(); w.loadScenario('horde-arena', 1);
  try {
    const vehicles = w.vehicles!, carId = vehicles.spawn('vehicle.sedan', { x: 5, z: 0 }), car = vehicles.cars.get(carId)!;
    const id = w.spawnDummy('infected.runner', { x: 5, z: 1 }), infected = w.entities.get(id)!;
    const contacts = () => (vehicles as unknown as { infected(record: typeof car): void }).infected(car);
    contacts();
    expect(car.entity.vehicle!.attached).toEqual([]);
    expect(infected.attachedTo).toBeUndefined();
    car.entity.vehicle!.driver = 1; contacts();
    expect(car.entity.vehicle!.attached).toEqual([id]);
    expect(infected.attachedTo).toBe(carId);
    car.entity.vehicle!.driver = null; contacts();
    expect(car.entity.vehicle!.attached).toEqual([]);
    expect(infected.attachedTo).toBeUndefined();
  } finally { w.dispose(); }
});
