import { expect, test, vi } from 'vitest';
import { l4 } from '../../src/data/l4';
import { loadL4, runL4 } from '../../tools/sim-runner/l4Bots';

for (const tier of ['high', 'low'] as const) test(`T-E22-20-alarm @E22-AC20 ${tier} alarm actors have one final admission with their original IDs and full population`, async () => {
  const { world, mission } = await loadL4(2, tier);
  try {
    const admit = vi.spyOn(world.solids, 'admit'); let ids: number[] = [];
    world.events.on('l4.firstTurn', event => { if (event.type === 'l4.firstTurn') ids = [...event.ids]; });
    runL4(world, mission, 'complete', { seed: 2, god: true, maxSeconds: 180, stopWhen: () => mission.state.l4!.turnAt > 0 });
    expect(ids).toHaveLength(l4.calm.alarmInfected[tier]);
    for (const id of ids) {
      const calls = admit.mock.calls.filter(([e]) => e.id === id);
      expect(calls.map(([, writer]) => writer)).toEqual(['l4.alarm.exit']);
      const e = world.entities.get(id)!;
      expect(e.infected).toBeDefined(); expect(e.appearance?.entityId).toBe(id);
      expect(e.pendingAdmission !== undefined || world.solids.clear(e.transform, e.combat!.radius, id)).toBe(true);
    }
    expect(world.solids.snapshot().failures).toBe(0);
  } finally { world.dispose(); }
}, 180_000);
