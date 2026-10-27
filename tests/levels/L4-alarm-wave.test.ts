import { expect, test } from 'vitest';
import { l4 } from '../../src/data/l4';
import { loadL4 } from '../../tools/sim-runner/l4Bots';
import { followFrustum } from '../../tools/sim-runner/l3Bots';

// PO #118 (10-22): "The alarm was ringing already, but so far only one alpha entered. Zero Zombies." The alarm wave must spawn its authored
// count at the turn, and the army re-downing every infected that gets up must not pin the war cap: waves keep emerging during the hold.
for (const tier of ['high', 'low'] as const) {
  test(`@nightly L4 alarm wave spawns its authored count and the hold keeps getting infected (${tier})`, async () => {
    const { world: w, mission: m } = await loadL4(1, tier);
    try {
      w.combat!.damage.god = true;
      while (m.state.l4!.phase === 'convoy') { followFrustum(w, 1.5); w.update(); }
      m.completeObjective('quartermaster');
      while (!m.state.l4!.turnAt) { followFrustum(w, 1.5); w.update(); }
      const live = () => [...w.entities.iterate()].filter(e => e.infected && !e.hidden && e.health.current > 0 && e.archetype !== 'infected.alpha');
      const authored = l4.calm.alarmInfected[tier];
      const alarmIds = m.state.l4!.emergedIds.slice(0, authored);
      expect(alarmIds.length, 'the full authored alarm group is assigned to the authored tent doors').toBe(authored);
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

test('@nightly L4 queues the full authored street population while capacity is full, then admits it without dropping the backlog', async () => {
  const { world, mission } = await loadL4(3, 'high');
  try {
    while (mission.state.l4!.phase === 'convoy') { followFrustum(world, 1.5); world.update(); }
    mission.completeObjective('quartermaster');
    while (!mission.state.l4!.turnAt) { followFrustum(world, 1.5); world.update(); }
    const state = mission.state.l4!, director = world.infected!.director;
    const war = mission.l4! as unknown as { waves(): void; flushGroups(): void };
    const originalCap = director.levelCap, before = state.emergedIds.length;
    director.levelCap = 1; state.pend.fill(0); state.wave = 0;
    let authored = 0;
    world.events.on('l4.wave', event => { if (event.type === 'l4.wave') authored += event.count; });
    // Hold admission closed for the complete authored schedule, beyond the
    // former per-mouth queue ceiling. Capacity limits live bodies, not quotas.
    for (let wave = 0; wave < l4.war.waveSize.length; wave++) {
      state.waveAt = world.tick; war.waves(); world.tick += Math.ceil(l4.war.waveEveryS * 60);
    }
    expect(state.emergedIds.length).toBe(before);
    expect(state.pend.reduce((sum, n) => sum + n, 0)).toBe(authored);
    director.levelCap = originalCap; state.edgeNext.fill(0);
    war.flushGroups();
    const admitted = state.emergedIds.length - before;
    expect(admitted).toBeGreaterThan(0);
    expect(state.pend.reduce((sum, n) => sum + n, 0) + admitted).toBe(authored);
  } finally { world.dispose(); }
});
