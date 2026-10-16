import { expect, test } from 'vitest';
import { emptyInput } from '../../src/input/InputFrame';
import { loadL5 } from '../../tools/sim-runner/l5Bots';

// The full browser playthrough covers protection and handover. Isolate the
// ordinary persistent click at its audited Sam-to-Mia stop here.
test('T-E23-17-travel @E23 @E23-AC17 one ground click routes from the Sam corner to Mia without repeated cancellation', async () => {
  const { world, mission } = await loadL5(1);
  try {
    mission.completeObjective('emerge');
    for (let tick = 0; tick < 661; tick++) world.update();
    for (const infected of [...world.infected!.active]) world.infected!.release(infected);
    const player = world.entities.get(1)!;
    Object.assign(player.transform, { x: -52.53428649902344, z: 41.12894821166992 });
    Object.assign(world.previousPlayer!, player.transform);
    world.physics.playerBody!.setTranslation(player.transform, true);
    world.physics.playerBody!.setNextKinematicTranslation(player.transform);
    world.spatial.set(1, player.transform.x, player.transform.z);
    const goal = mission.def.anchors['l5-ring-mia'];
    world.applyInput({ ...emptyInput(), walk: true, cancelMove: true, pointerGround: true, moveTarget: { x: goal.x, z: goal.z } }, 'mouse-only');
    world.update();
    world.applyInput({ ...emptyInput(), walk: true }, 'mouse-only');
    let ticks = 0;
    while (ticks++ < 4200 && Math.hypot(player.transform.x - goal.x, player.transform.z - goal.z) > 1.6) world.update();
    expect(Math.hypot(player.transform.x - goal.x, player.transform.z - goal.z)).toBeLessThanOrEqual(1.6);
    expect(player.health.current).toBe(player.health.max);
  } finally { world.dispose(); }
}, 120_000);
