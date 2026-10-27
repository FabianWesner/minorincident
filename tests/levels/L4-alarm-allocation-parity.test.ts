import { expect, test } from 'vitest';
import { l4 } from '../../src/data/l4';
import { loadL4, runL4 } from '../../tools/sim-runner/l4Bots';

test('T-E22-20-refuge @E22-AC20 exterior street alarm allocation keeps seeded identities, targets and events deterministic', async () => {
  const run = async () => {
    const { world, mission } = await loadL4(2, 'low');
    try {
      runL4(world, mission, 'complete', { seed: 2, god: true, maxSeconds: 180, stopWhen: () => mission.state.l4!.turnAt > 0 && world.tick >= mission.state.l4!.turnAt + 120 });
      expect(mission.state.l4!.turnAt).toBeGreaterThan(0);
      const s = mission.state.l4!;
      // The alarm uses exterior street mouths. Keep identity, source positions,
      // targets and event order stable for the same seed.
      const alarmIds = s.emergedIds.slice(0, l4.calm.alarmInfected.low);
      return { tick: world.tick, entities: world.query({}), mission: structuredClone(mission.state), events: world.events.events(), alarmIds };
    } finally { world.dispose(); }
  };
  const current = await run(), replay = await run();
  expect(current).toEqual(replay);
  expect(current.alarmIds).toHaveLength(l4.calm.alarmInfected.low);
}, 180_000);
