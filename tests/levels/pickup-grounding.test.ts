import { expect, test } from 'vitest';
import { loadLevel } from '../../tools/sim-runner/levels';
import { missionIds } from '../../src/levels/missions';

/**
 * PO 10-13 "There med packs BELOW the highway" (L3, player on the ramp): the medkit sat at the ramp's xz but was drawn at world y 0, on the
 * street under the deck. Guard over every level: each ground pickup (medkit, soda, items) is on a nav cell from which the objective is
 * reachable on foot (`TrapRescue.reachable`, so not on a lower street the route never visits), and it rests within 5 cm of the support
 * at its xz: the deck/ramp where the route runs over it. The view draws it at `transform.y - 0.3` (the same y), never at 0.
 */
for (const level of missionIds) test(`@pickup-grounding ${level}: every pickup is reachable from the route and rests on the support at its xz`, async () => {
  const world = await loadLevel(level, 1);
  try {
    const d = world.districts!, rescue = world.trapRescue, bad: string[] = [];
    let count = 0;
    for (const e of world.entities.iterate()) {
      if (!e.pickup || !('kind' in e.pickup)) continue;
      count++;
      const { x, y, z } = e.transform, support = d.pavingHeight(x, z), name = `${e.archetype}#${e.id} (${x.toFixed(1)}, ${z.toFixed(1)})`;
      if (rescue && !rescue.reachable(x, z)) bad.push(`${name} is on a cell the route cannot reach`);
      if (Math.abs(y - .3 - support) > .05) bad.push(`${name} y ${(y - .3).toFixed(2)} vs support ${support.toFixed(2)}`);
    }
    if (level === 'L3') expect(count, 'L3 medkits (incl. the three on the highway)').toBeGreaterThan(30);
    expect(bad.slice(0, 10), `${bad.length}/${count} pickups`).toEqual([]);
  } finally { world.dispose(); }
}, 180000);
