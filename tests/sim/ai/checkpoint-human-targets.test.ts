import { expect, test } from 'vitest';
import { WorldHumans } from '../../../src/sim/ai/Perception';
import { loadL3 } from '../../../tools/sim-runner/l3Bots';

/** A restored healthy officer must lose the previous timeline's bite exclusion. */
test('T-E21-10-restore @E21 @E21-AC10 checkpoint officers remain huntable after a previous bite; saved infection stays excluded', async () => {
  const { world, mission } = await loadL3(1);
  try {
    const query = world.infected!.hearing.humans;
    expect(query).toBeInstanceOf(WorldHumans);
    const humans = query as WorldHumans;
    const [healthy, infected] = mission.state.l3!.officerIds;
    world.npcs!.civilians.outbreak!.infect(world.entities.get(infected)!, 1);
    mission.checkpoint('armory');
    expect(humans.get(healthy)).toBeDefined();
    expect(humans.get(infected)).toBeUndefined();
    // The AI records a completed bite immediately, before the outbreak layer converts its victim.
    humans.bitten.add(healthy);
    world.npcs!.civilians.outbreak!.infect(world.entities.get(healthy)!, 1);
    expect(humans.get(healthy)).toBeUndefined();
    mission.restore('armory');
    expect(world.entities.get(healthy)!.infection).toBeUndefined();
    expect(humans.get(healthy)?.kind).toBe('civilian');
    expect(world.entities.get(infected)!.infection).toBeDefined();
    expect(humans.get(infected)).toBeUndefined();
  } finally { world.dispose(); }
});
