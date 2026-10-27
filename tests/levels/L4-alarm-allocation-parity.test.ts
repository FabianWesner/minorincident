import { expect, test } from 'vitest';
import { l4 } from '../../src/data/l4';
import { loadL4, runL4 } from '../../tools/sim-runner/l4Bots';

test('@nightly T-E22-20-refuge @E22-AC20 tent-door allocation keeps alarm identities, looks, targets, events and seeded outcomes', async () => {
  const run = async () => {
    const { world, mission } = await loadL4(2, 'low');
    try {
      runL4(world, mission, 'complete', { seed: 2, god: true, maxSeconds: 180, stopWhen: () => mission.state.l4!.turnAt > 0 && world.tick >= mission.state.l4!.turnAt + 120 });
      expect(mission.state.l4!.turnAt).toBeGreaterThan(0);
      const s = mission.state.l4!;
      // The alarm is a scripted tent-door walkout. Keep identity, appearance,
      // emergence path, target and event order stable for the same seed.
      const alarmIds = s.emergedIds.slice(0, l4.calm.alarmInfected.low);
      return { tick: world.tick, entities: world.query({}), mission: structuredClone(mission.state), events: world.events.events(), alarmIds };
    } finally { world.dispose(); }
  };
  const current = await run(), replay = await run();
  expect(current).toEqual(replay);
  expect(current.alarmIds).toHaveLength(l4.calm.alarmInfected.low);
}, 180_000);
