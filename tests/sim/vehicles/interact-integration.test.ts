import { expect, test } from 'vitest';
import { SimWorld } from '../../../src/sim/world/SimWorld';

test('M1 E09/E11 @E09 @E09-AC05 @E11 @E11-AC07 driving breaks an authored fence and updates its infected nav/debris', async () => {
  const w = new SimWorld(); await w.init(); w.loadScenario('horde-arena', 7);
  try {
    const id = w.vehicles!.spawn('vehicle.sedan', { x: 0, z: 0 });
    w.vehicles!.obstacles.spawn('wall', { x: 10, z: 0 }); expect(w.infected!.nav.clear(10, 0)).toBe(false);
    const fence = w.hazards!.spawn('fence', { x: 2.6, z: 0 });
    const car = w.vehicles!.cars.get(id)!;
    car.physics.body.setLinvel({ x: 8, y: 0, z: 0 }, true); car.physics.postPhysics(); w.update();
    expect(w.entities.get(fence)!.destructible!.broken).toBe(true);
    expect(w.hazards!.debris.snapshot()).toHaveLength(8);
    expect(w.infected!.nav.clear(2.6, 0)).toBe(true);
    expect(w.events.events()).toContainEqual({ type: 'vehicle.obstacle-broken', tick: 1, targetId: fence });
  } finally { w.dispose(); }
});

test('M1 E09/E12 @E09 @E09-AC02 @E12 @E12-AC05 checkpoint rebinds vehicles to restored records and native bodies', async () => {
  const { missionSandbox } = await import('../../fixtures/scenarios/mission-sandbox');
  const w = new SimWorld(); await w.init(); w.loadScenario('mission-sandbox', 7);
  try {
    const id = w.vehicles!.spawn('vehicle.sedan', { x: 10, z: 0 });
    const mission = w.loadMission(missionSandbox()); mission.begin(); mission.checkpoint('C');
    const bodies = w.physics.bodyCount;
    w.vehicles!.damage(id, 50); w.vehicles!.spawn('vehicle.police', { x: 20, z: 0 });
    mission.restore('C');
    expect(w.vehicles!.cars.size).toBe(1);
    expect(w.vehicles!.cars.get(id)!.entity).toBe(w.entities.get(id));
    expect(w.entities.get(id)!.health.current).toBe(w.entities.get(id)!.health.max);
    expect(w.physics.bodyCount).toBe(bodies);
    w.update(); expect(w.entities.get(id)!.transform.x).toBeCloseTo(10);
  } finally { w.dispose(); }
});


test('M1 E07/E09 @E09 @E09-AC07 attached infected stay anchored while their chase brain is suspended', async () => {
  const w = new SimWorld(); await w.init(); w.loadScenario('horde-arena', 7); w.combat!.damage.god = true;
  try {
    const car = w.vehicles!.spawn('vehicle.sedan', { x: 5, z: 0 });
    const id = w.infected!.spawn('infected.runner', { x: 5, z: 1 }, { state: 'chase' });
    for (let i = 0; i < 60; i++) w.update();
    expect(w.entities.get(id)!.attachedTo).toBe(car);
    const attacks = w.events.events().filter(e=>e.type==='infected.attack' && e.sourceId===id);
    expect(attacks).toHaveLength(0);
    expect(Math.hypot(w.entities.get(id)!.transform.x-w.entities.get(car)!.transform.x,w.entities.get(id)!.transform.z-w.entities.get(car)!.transform.z)).toBeLessThan(1.5);
  } finally { w.dispose(); }
});
