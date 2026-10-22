import { expect, test } from 'vitest';
import { l4 } from '../../src/data/l4';
import { loadL4 } from '../../tools/sim-runner/l4Bots';

// PO #118 (10-22): "The alarm was ringing already, but so far only one alpha entered. Zero Zombies." The alarm wave must spawn its authored
// count at the turn, and the army re-downing every infected that gets up must not pin the war cap: waves keep emerging during the hold.
for (const tier of ['high', 'low'] as const) {
  test(`L4 alarm wave spawns its authored count and the hold keeps getting infected (${tier})`, async () => {
    const { world: w, mission: m } = await loadL4(1, tier);
    try {
      w.combat!.damage.god = true;
      while (m.state.l4!.phase === 'convoy') w.update();
      m.completeObjective('quartermaster');
      while (!m.state.l4!.turnAt) w.update();
      const live = () => [...w.entities.iterate()].filter(e => e.infected && !e.hidden && e.health.current > 0 && e.archetype !== 'infected.alpha');
      const authored = l4.calm.alarmInfected[tier];
      expect(live().length, 'alarm infected right after the turn').toBeGreaterThanOrEqual(Math.floor(authored * .8));
      let emergedAt30 = 0;
      for (let i = 0; i < 75 * 60; i++) {
        w.update();
        if (i === 30 * 60) emergedAt30 = m.state.l4!.emergedIds.length;
      }
      expect(m.state.l4!.phase, 'still the hold').toBe('war');
      expect(m.state.l4!.emergedIds.length - emergedAt30, 'infected still emerging 30-75 s into the hold').toBeGreaterThanOrEqual(authored);
      expect(live().length, 'infected alive 75 s into the hold').toBeGreaterThan(0);
    } finally { w.dispose(); }
  }, 300_000);
}
