import { expect, test } from 'vitest';
import { l4TentEntrances } from '../../../src/data/l4';
import { loadL4 } from '../../../tools/sim-runner/l4Bots';

test('L4 tent walkouts reach connected plaza navigation without crossing furniture', async () => {
  const { world } = await loadL4(3, 'low');
  try {
    const nav = world.infected!.infectedNav;
    for (const door of l4TentEntrances) {
      // The first 40 cm belong to the open flap; the remainder must clear real solids.
      const end = Math.hypot(door.step[0] - door.at[0], door.step[1] - door.at[1]);
      for (let d = .4; d <= end; d += .1) expect(nav.clear(door.at[0] + door.out[0] * d, door.at[1] + door.out[1] * d, .35)).toBe(true);
      const last = door.route.at(-1) ?? door.step, start = nav.nearestCell(last[0], last[1], .35);
      expect(start, 'the real tent exit must lie on navigation').toBeGreaterThanOrEqual(0);
      expect(nav.path(start, nav.nearestCell(-21.5, 3), [], 1_000_000), 'the exit must connect to the plaza').toBe(true);
    }
  } finally { world.dispose(); }
});
