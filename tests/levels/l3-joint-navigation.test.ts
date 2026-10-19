import { expect, test } from 'vitest';
import { loadL3 } from '../../tools/sim-runner/l3Bots';

test('L3 closed bridge rail joints retain the full NPC route from span to east ramp', async () => {
  const { world: w } = await loadL3(1);
  try {
    const nav = w.infected!.nav;
    for (const radius of [.35, .55, .65]) {
      const path: number[] = [], from = nav.nearestCell(172, 0, radius), to = nav.nearestCell(207, 0, radius);
      expect(nav.path(from, to, path, 100000), `radius ${radius}: ${from} -> ${to}`).toBe(true);
    }
  } finally { w.dispose(); }
}, 120_000);
