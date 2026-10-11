import { expect, test } from 'vitest';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import { vehicles } from '../../../src/data/vehicles';
import { carDoorWeight, carTransitionPose } from '../../../src/render/characters/carTransition';

test('PKG-09 @E09-AC02 the door opens before boarding/step-down and closes after the courier clears it', async () => {
  expect(carDoorWeight(0)).toBe(0); expect(carDoorWeight(12)).toBe(1);
  expect(carDoorWeight(42)).toBe(1); expect(carDoorWeight(60)).toBe(0);
  const world = new SimWorld(); await world.init(); world.loadScenario('survivor');
  try {
    for (const def of vehicles) {
      const id = world.vehicles!.spawn(def.id, { x: 0, z: 0 });
      const player = world.entities.get(1)!;
      Object.assign(player.transform, { x: def.doorX, y: .72, z: def.width / 2 + .55 });
      world.physics.playerBody!.setTranslation(player.transform, true);
      world.physics.playerBody!.setNextKinematicTranslation(player.transform);
      world.setInput({ interact: true }); world.update(); world.clearInput();
      expect(world.vehicles!.active, def.id).toBe(id); expect(player.hidden).toBe(true);
      const entered = world.tick;
      expect(carTransitionPose(world, 1)?.visible).toBe(true);
      expect(carTransitionPose(world, 0)?.visible).toBe(true); // First interpolated render cannot blink out.
      world.tick = entered + 12; expect(carTransitionPose(world, 1)?.visible).toBe(true);
      world.tick = entered + 41; expect(carTransitionPose(world, 1)?.visible).toBe(true);
      world.tick = entered + 42; expect(carTransitionPose(world, 1)?.visible).toBe(false);
      expect(world.vehicles!.exit()).toBe(true); expect(player.hidden).toBe(false);
      const car = world.entities.get(id)!;
      expect(Math.hypot(player.transform.x - car.transform.x, player.transform.z - car.transform.z)).toBeLessThanOrEqual(2.5);
      const exited = world.tick;
      expect(carTransitionPose(world, 1)?.visible).toBe(false);
      world.tick = exited + 12; expect(carTransitionPose(world, 1)?.visible).toBe(true);
      world.tick = exited + 42;
      const landed = carTransitionPose(world, 1)!;
      expect(landed.x).toBeCloseTo(player.transform.x); expect(landed.z).toBeCloseTo(player.transform.z);
      world.tick = exited + 60; expect(carTransitionPose(world, 1)).toBeNull();
      world.loadScenario('survivor'); expect(world.vehicles!.transition).toBeNull();
    }
  } finally { world.dispose(); }
});
