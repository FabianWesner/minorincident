import { expect, test } from 'vitest';
import * as RAPIER from '@dimforge/rapier3d-compat';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import { emptyInput } from '../../../src/input/InputFrame';
function step(world: SimWorld, ticks: number) { for (let i = 0; i < ticks; i++) world.update(); }
test('T-E09-02 @E09-AC02 door dwell, input ownership and capsule-safe exit on opposite side', async () => {
  const world = new SimWorld(); await world.init(); world.loadScenario('drive-course');
  try {
    step(world, 35); expect(world.vehicles!.active).toBeNull();
    step(world, 1); expect(world.vehicles!.active).toBe(2); expect(world.getEntity(1)!.hidden).toBe(true);
    expect(world.physics.playerCollider!.isEnabled()).toBe(false);
    const frame = emptyInput(); frame.move.x = 1; frame.drive = { throttle: 1, steer: 0 }; frame.left.down = frame.left.held = true;
    world.applyInput(frame, 'keyboard'); step(world, 240);
    const car = world.vehicles!.cars.get(2)!;
    expect(car.physics.speed).toBeGreaterThan(14.4); expect(world.entities.get(1)!.transform.x).toBe(car.entity.transform.x);
    expect(world.events.events().some(e => e.type === 'combat.attack')).toBe(false);
    expect(world.events.events().some(e => e.type === 'noise' && e.kind === 'horn')).toBe(true);
    // Put a wall across the left exit candidates while leaving the right clear.
    const p = car.entity.transform;
    world.physics.world!.createCollider(RAPIER.ColliderDesc.cuboid(1.6, 1, .3).setTranslation(p.x, 1, p.z + 1.45));
    world.physics.world!.step();
    expect(world.vehicles!.exit()).toBe(true);
    const exit = world.getEntity(1)!;
    expect(exit.hidden).toBe(false); expect(exit.transform.z).toBeLessThan(p.z);
    expect(Math.hypot(exit.transform.x - p.x, exit.transform.z - p.z)).toBeLessThanOrEqual(2.5);
    expect(world.physics.world!.intersectionWithShape(exit.transform, { x: 0, y: 0, z: 0, w: 1 }, new RAPIER.Capsule(.35, .35), undefined, undefined, world.physics.playerCollider!)).toBeNull();
    expect(world.events.events().filter(e => e.type === 'vehicle.entered')).toHaveLength(1);
    expect(world.events.events().filter(e => e.type === 'vehicle.exited')).toHaveLength(1);
    world.loadScenario('empty'); expect(world.physics.bodyCount).toBe(2);
  } finally { world.dispose(); }
});
test('T-E09-02b @E09-AC02 walking or leaving the ring resets the full dwell timer', async () => {
  const world = new SimWorld(); await world.init(); world.loadScenario('drive-course');
  try { step(world, 20); world.setInput({ move: { x: 1, z: 0 } }); step(world, 1); world.clearInput(); step(world, 35); expect(world.vehicles!.active).toBeNull(); step(world, 1); expect(world.vehicles!.active).toBe(2); } finally { world.dispose(); }
});

test('T-E09-siren @E09 police siren lures hearing fixtures through the shared noise response', async () => {
  const world = new SimWorld(); await world.init(); world.loadScenario('drive-course');
  try {
    const player = world.entities.get(1)!; player.transform.z = 13.45; world.physics.playerBody!.setTranslation(player.transform, true); world.physics.playerBody!.setNextKinematicTranslation(player.transform);
    const infected = world.spawnDummy('infected.runner', { x: 20, z: 12 }, { reactive: true }); step(world, 60);
    expect(world.entities.get(infected)!.hearing!.mode).toBe('investigate'); expect(world.entities.get(infected)!.hearing!.target.z).toBeCloseTo(12);
    expect(world.events.events().some(e => e.type === 'noise' && e.sourceId === 3 && e.kind === 'siren')).toBe(true);
  } finally { world.dispose(); }
});

test('T-E09-02c @E09-AC02 a moving car can exit after a 50m drive on the large course ground', async () => {
  const { Driver } = await import('../../../src/debug/bot/Driver');
  const world = new SimWorld(); await world.init(); world.loadScenario('drive-course');
  try { const driver = new Driver(world); for (let i = 0; i < 480; i++) { world.applyInput(driver.sample(), 'keyboard'); world.update(); } expect(world.getEntity(2)!.transform.x).toBeGreaterThan(50); expect(world.vehicles!.exit()).toBe(true); expect(world.getEntity(1)!.hidden).toBe(false); } finally { world.dispose(); }
});
