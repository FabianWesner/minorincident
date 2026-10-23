import { expect, test } from 'vitest';
import { l4 } from '../../src/data/l4';
import { loadL4 } from '../../tools/sim-runner/l4Bots';
import { followFrustum } from '../../tools/sim-runner/l3Bots';

// PO #118 (10-22): "The alarm was ringing already, but so far only one alpha entered. Zero Zombies." The alarm wave must spawn its authored
// count at the turn, and the army re-downing every infected that gets up must not pin the war cap: waves keep emerging during the hold.
for (const tier of ['high', 'low'] as const) {
  test(`L4 alarm wave spawns its authored count and the hold keeps getting infected (${tier})`, async () => {
    const { world: w, mission: m } = await loadL4(1, tier);
    try {
      w.combat!.damage.god = true;
      while (m.state.l4!.phase === 'convoy') { followFrustum(w, 1.5); w.update(); }
      m.completeObjective('quartermaster');
      while (!m.state.l4!.turnAt) { followFrustum(w, 1.5); w.update(); }
      const live = () => [...w.entities.iterate()].filter(e => e.infected && !e.hidden && e.health.current > 0 && e.archetype !== 'infected.alpha');
      const authored = l4.calm.alarmInfected[tier];
      const alarmIds = m.state.l4!.emergedIds.slice(0, authored);
      expect(alarmIds.length, 'the full authored alarm group is assigned to the three tent doors').toBe(authored);
      expect(alarmIds.filter(id => w.entities.get(id)?.emerging).length, 'the alarm group is walking out, not popping into the plaza').toBe(authored);
      let emergedAt30 = 0;
      for (let i = 0; i < 75 * 60; i++) {
        followFrustum(w, 1.5); w.update();
        if (i === 30 * 60) emergedAt30 = m.state.l4!.emergedIds.length;
      }
      expect(m.state.l4!.phase, 'still the hold').toBe('war');
      expect(m.state.l4!.emergedIds.length - emergedAt30, 'infected still emerging 30-75 s into the hold').toBeGreaterThanOrEqual(authored);
      expect(live().length, 'infected alive 75 s into the hold').toBeGreaterThan(0);
    } finally { w.dispose(); }
  }, 300_000);
}
