import { expect, test } from 'vitest';
import { SimWorld } from '../../src/sim/world/SimWorld';
import type { EntitySnapshot } from '../../src/sim/world/types';
import type { InfectedState } from '../../src/sim/ai/types';
import type { L1Brain } from '../../src/sim/ai/Search';

type ApproachBrain = {
  attractedL1(e: EntitySnapshot, state: InfectedState, brain: L1Brain): void;
  herdCue(e: EntitySnapshot, brain: L1Brain): void;
};

for (const cause of ['long detour', 'visible herd'] as const) test(`a directed approach retains its destination during a ${cause}`, async () => {
  const w = new SimWorld(); await w.init(); w.loadScenario('horde-arena', 1);
  try {
    const ai = w.infected!; ai.configureL1v2();
    const id = ai.spawn('infected.runner', { x: 0, z: 0 }, { yaw: 0 });
    const e = w.entities.get(id)!, state = e.infected!, brain = state.l1!;
    ai.rush(id, { x: 20, z: 0 }, w.tick + 1800);
    const goal = [brain.goalX, brain.goalZ], until = brain.search.until;
    if (cause === 'long detour') {
      // This is still an active approach, with real progress possible and its own deadline remaining.
      brain.search.legTicks = 600;
      (ai as unknown as ApproachBrain).attractedL1(e, state, brain);
    } else {
      const cueId = ai.spawn('infected.runner', { x: 3, z: 0 }, { yaw: 0 });
      const cue = w.entities.get(cueId)!; cue.infected!.l1!.mode = 'chase';
      expect(ai.l1!.sees(e, cue.transform), 'the heading cue is actually visible').toBe(true);
      (ai as unknown as ApproachBrain).herdCue(e, brain);
      expect(brain.cueUntil).toBe(0);
    }
    expect(brain.mode).toBe('attracted');
    expect([brain.goalX, brain.goalZ]).toEqual(goal);
    expect(brain.search.until).toBe(until);
  } finally { w.dispose(); }
});
