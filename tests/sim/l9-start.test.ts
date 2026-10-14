import { expect, test } from 'vitest';
import { applyCampaign } from '../../src/sim/progression/apply';
import { preset } from '../../src/sim/progression/Campaign';
import { loadLevel } from '../../tools/sim-runner/levels';
import { SimWorld } from '../../src/sim/world/SimWorld';
import { emptyInput } from '../../src/input/InputFrame';

for (const hp of [730, 0]) test(`T-E31-02 @E31-AC02 actual L9 start restores the same APC, arsenal and living occupants at ${hp} HP`, async () => {
  const source = new SimWorld(); await source.init(); source.loadScenario('horde-arena', 1);
  let destination: SimWorld | undefined;
  try {
    const save = preset('L8-default'); save.completedLevels = 8; save.unlockedLevel = 9;
    applyCampaign(source, save);
    source.entities.reserveIds([10_000]);
    const id = source.vehicles!.spawn('vehicle.military-apc', { x: 0, z: 0 });
    const car = source.vehicles!.cars.get(id)!;
    source.vehicles!.setFloorPolicy(id); source.vehicles!.damage(id, 1000 - hp);
    source.entities.get(1)!.health.current = 63;
    car.entity.vehicle!.driver = 1; source.vehicles!.rebuild();
    const door = { x: car.physics.def.doorX, z: car.physics.def.width / 2 + .55 };
    const survivor = source.npcs!.civilians.spawn('civilian', door, { waypoints: [door] });
    source.entities.get(survivor)!.health.current = 81;
    expect(source.vehicles!.boardPassenger(id, survivor)).toBe(true);
    for (let tick = 0; tick < 90; tick++) source.update();
    save.transport = source.vehicles!.transfer(id);
    destination = await loadLevel('L9', 1, save);
    const w = destination;
    expect(w.vehicles!.active).toBe(id); expect(w.missions!.l9!.state.carId).toBe(id);
    expect(w.entities.get(id)!.health).toEqual(save.transport.vehicle.health);
    for (const e of save.transport.occupants) {
      expect(w.entities.get(e.id)!.health).toEqual(e.health);
      if (e.weapons) expect(w.entities.get(e.id)!.weapons).toEqual(e.weapons);
    }
    expect([...w.entities.iterate()].filter(e => e.passengerOf === id).map(e => e.id).sort()).toEqual(save.transport.occupants.filter(e => e.id !== 1).map(e => e.id).sort());
    const start = w.entities.get(id)!.transform.x;
    w.applyInput({ ...emptyInput(), drive: { throttle: 1, steer: 0 } }, 'keyboard');
    for (let tick = 0; tick < 30; tick++) w.update();
    expect(w.entities.get(id)!.transform.x).toBeGreaterThan(start);
    expect(w.entities.get(id)!.health.current).toBe(hp);
    expect(w.missions!.state.phase).toBe('playing');
  } finally { source.dispose(); destination?.dispose(); }
});
