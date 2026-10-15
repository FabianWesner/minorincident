import { expect, test } from 'vitest';
import { loadLevel } from '../../tools/sim-runner/levels';
import { missionIds } from '../../src/levels/missions';

/** Every shipped composition runs the same final contact guard as Scene Lab. No camera/quality exemption. */
test.each([...missionIds, 'L7'] as const)('%s: committed actor occupancy stays valid, including stationary full audits', async level => {
  const w = await loadLevel(level, 1);
  try {
    for (let tick = 0; tick < 300; tick++) {
      w.update();
      expect(w.solids.offenders, `tick ${w.tick}`).toEqual([]);
    }
    expect(w.solids.failures).toBe(0);
  } finally { w.dispose(); }
}, 120_000);
