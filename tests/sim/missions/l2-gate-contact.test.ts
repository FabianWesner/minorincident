import { expect, test } from 'vitest';
import { loadLevel } from '../../../tools/sim-runner/levels';

test('@E20 the closed south gate joins its fence and keeps permitted contact outside the checkpoint', async () => {
  const world = await loadLevel('L2', 1);
  try {
    const mission = world.missions!, player = world.entities.get(1)!;
    world.update(); mission.l2!.completed('doors'); mission.l2!.advance();
    expect(world.solids.relocate(player, { x: 82, y: .705, z: 32 }, 'test.l2-gate')).toBe(true);
    for (let tick = 0; tick < 60 && !mission.state.l2!.gateClosedAt; tick++) world.update();
    expect(mission.state.l2!.gateClosedAt).toBeGreaterThan(0);
    // The old panel ended at x=82.75; the fence starts at 83.465, leaving
    // 0.715 m for a .7 m circle. Neither that jamb nor the 2 cm contact margin
    // may admit a centre inside the unchanged z=35.6 checkpoint boundary.
    for (const x of [80.6, 81.5, 82.5, 83.107]) {
      expect(world.solids.clear({ x, y: .7, z: 35.59 }, .35, player.id, false, .02), `south gate at ${x}`).toBe(false);
    }
    expect(world.solids.snapshot()).toMatchObject({ failures: 0, pending: 0 });
  } finally { world.dispose(); }
});
