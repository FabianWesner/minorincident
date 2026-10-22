import { afterEach, expect, test } from 'vitest';
import { loadLevel } from '../../../tools/sim-runner/levels';
import type { SimWorld } from '../../../src/sim/world/SimWorld';
import { step } from './helpers';
const worlds: SimWorld[] = [];
afterEach(() => { for (const w of worlds.splice(0)) w.dispose(); });
for (const tier of ['high', 'low'] as const) for (const blocked of [false, true]) {
  test(`@E30-AC13 @E30-AC18 rotated APC doorway ${tier} ${blocked ? 'physical obstruction remains solid' : 'follower walks through the clear hull-side gap'}`, async () => {
    const w = await loadLevel('L8', 1); worlds.push(w); w.npcs!.setQuality(tier); w.combat!.damage.god = true;
    const zoo = w.missions!.l8!, car = w.entities.get(zoo.state.carId)!;
    zoo.state.breachedAt = w.tick || 1; zoo.state.nextWave = 1e9;
    car.transform.yaw = 1.0186425309279823; car.vehicle!.driver = 1; w.vehicles!.rebuild(); step(w, 60);
    const actor = w.entities.get(zoo.state.roster[0])!, door = zoo.door(), yaw = car.transform.yaw;
    const normal = { x: Math.sin(yaw), z: Math.cos(yaw) };
    Object.assign(actor.transform, { x: door.x + normal.x * 1.25, z: door.z + normal.z * 1.25, y: w.districts!.groundHeight(door.x, door.z) + .72 });
    w.spatial.set(actor.id, actor.transform.x, actor.transform.z); w.solids.remember(actor, 'test.rotated-door');
    // Reproduce the actual native phone trap: conservative navigation blocks
    // the door while the canonical rotated hull leaves its approach open.
    expect(w.infected!.nav.clear(door.x, door.z, .35, true)).toBe(false);
    expect(w.solids.clear({ ...door, y: actor.transform.y }, .35, actor.id, false)).toBe(true);
    if (blocked) w.solids.setBarrier('test-door-obstruction', { ...door, y: 1, halfX: .6, halfY: 1, halfZ: .6, yaw });
    let maxStep = 0, traveled = 0;
    for (let i = 0; i < 360 && actor.passengerOf === undefined; i++) {
      const before = { ...actor.transform }; step(w, 1);
      const distance = Math.hypot(actor.transform.x - before.x, actor.transform.z - before.z);
      maxStep = Math.max(maxStep, distance); traveled += distance;
    }
    expect(maxStep, 'approach remains continuous, never a teleport').toBeLessThan(.2);
    if (blocked) expect(actor.passengerOf).toBeUndefined();
    else { expect(actor.passengerOf).toBe(car.id); expect(traveled).toBeGreaterThan(.5); }
  });
}

// Positions from the failed native phone run, expressed in the APC's local frame.
const trappedRoster = [[-3.18, -.66], [1.807, 3.4], [1.21, 3.771], [-3.183, .758], [2.442, 3.731], [.534, 3.333], [-3.181, .048], [1.176, 3.058], [2.409, 3.017], [.614, 4.143], [-.005, 3.786], [1.779, 2.683]];
for (const tier of ['high', 'low'] as const) test(`T-E30-rotated-native-roster @E30-AC13 @E30-AC18 all twelve trapped native followers board ${tier}`, async () => {
  const w = await loadLevel('L8', 1); worlds.push(w); w.npcs!.setQuality(tier); w.combat!.damage.god = true;
  const zoo = w.missions!.l8!, car = w.entities.get(zoo.state.carId)!;
  zoo.state.breachedAt = w.tick || 1; zoo.state.nextWave = 1e9;
  car.transform.yaw = 1.0186425309279823; car.vehicle!.driver = 1; w.vehicles!.rebuild(); step(w, 60);
  const c = Math.cos(car.transform.yaw), s = Math.sin(car.transform.yaw);
  for (const [i, id] of zoo.state.roster.entries()) {
    const e = w.entities.get(id)!, [x, z] = trappedRoster[i];
    const at = { x: car.transform.x + c * x + s * z, z: car.transform.z - s * x + c * z };
    Object.assign(e.transform, at, { y: w.districts!.groundHeight(at.x, at.z) + .72 });
    w.spatial.set(id, at.x, at.z); w.solids.remember(e, 'test.native-roster');
  }
  step(w, 960);
  const remaining = zoo.state.roster.filter(id => w.entities.get(id)?.passengerOf !== car.id);
  expect(remaining, JSON.stringify(remaining.map(id => ({ id, at: w.entities.get(id)!.transform })))).toEqual([]);
});
