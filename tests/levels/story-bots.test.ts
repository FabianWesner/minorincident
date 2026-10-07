import { expect, test } from 'vitest';
import { loadL1, runL1 } from '../../tools/sim-runner/l1Bots';

test.each([['complete', 1], ['complete', 2], ['newbie', 1]] as const)('@E19 PO UAT story beats: %s bot still completes L1 (seed %i)', async (policy, seed) => {
  const { world, mission } = await loadL1(seed);
  try {
    const report = runL1(world, mission, policy, { seed });
    expect(mission.state.l1!.beatsDone).toEqual(expect.arrayContaining(['pickup', 'handover', 'garage']));
    expect(report.outcome ?? mission.state.phase).toBeTruthy();
    expect(['result', 'progression']).toContain(mission.state.phase);
  } finally { world.dispose(); }
}, 600_000);
