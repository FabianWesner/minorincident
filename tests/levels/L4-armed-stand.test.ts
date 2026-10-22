import { expect, test } from 'vitest';
import { loadL4 } from '../../tools/sim-runner/l4Bots';

// PO #115 (10-22): "What are they doing?" Armed civilians crouched with the gun in hand at the plaza steps: a sheltered civilian kept the
// 'npc-cower' story after the army rallied it. An armed survivor must never carry a cower story.
test('L4 armed civilians never keep the cower story once they rally', async () => {
  const { world: w, mission: m } = await loadL4(1);
  try {
    w.combat!.damage.god = true;
    while (m.state.l4!.phase === 'convoy') w.update();
    m.completeObjective('quartermaster');
    while (!m.state.l4!.turnAt) w.update();
    let armedSeen = 0, cowering = 0;
    for (let i = 0; i < 40 * 60; i++) {
      w.update();
      if (i % 30) continue;
      for (const e of w.entities.iterate()) {
        const c = e.civilian; if (!c?.ally || c.ally.role === 'soldier' || e.health.current <= 0) continue;
        armedSeen++; if (c.story?.clip === 'npc-cower') cowering++;
      }
    }
    expect(armedSeen, 'armed civilians exist').toBeGreaterThan(0);
    expect(cowering, 'armed civilian samples with the cower story').toBe(0);
  } finally { w.dispose(); }
}, 120_000);
