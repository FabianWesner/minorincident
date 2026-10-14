import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import { installMegaPursuit } from '../../../src/sim/ai/MegaPursuit';
import { levelTenMission } from '../../../src/levels/L10/mission';
import { applyCampaign } from '../../../src/sim/progression/apply';
import { preset } from '../../../src/sim/progression/Campaign';

for (const [count, budget] of [[200, 4], [100, 6]] as const) test(`T-E32-20-perf-${count} @E32-AC20 @E32-AC31 @E18-AC02 full-cap active dispersal predicate`, async () => {
  const w = new SimWorld(); await w.init();
  try {
    w.loadScenario(count === 200 ? 'perf-horde-200' : 'perf-horde-100'); w.combat!.damage.god = true;
    applyCampaign(w, preset('L10-default'));
    w.infected!.release(w.infected!.active[0]);
    const pursuit = installMegaPursuit(w, { introduceTick: null, resident: () => false }); pursuit.introduce({ x: -250, z: 0 });
    const at = w.entities.get(1)!.transform;
    const m = w.loadMission(levelTenMission(() => ({ x: at.x, z: at.z, radius: 2 })));
    m.begin(); m.loadCheckpoint('cure-disperse-ready');
    w.setInput({ interact: true }); w.update(); w.clearInput();
    expect(m.state.states['charge-active']).toBe(true); expect(m.state.counters['charge-ticks']).toBe(0);
    const times: number[] = [];
    for (let tick = 0; tick < 3600; tick++) {
      const start = performance.now(); w.update(); if (tick >= 120) times.push(performance.now() - start);
    }
    times.sort((a, b) => a - b);
    const proof = { count: w.infected!.director.count, chargeTicks: m.state.counters['charge-ticks'], boss: pursuit.state.mode, p95: times[Math.ceil(times.length * .95) - 1], budget };
    mkdirSync('test-results/epics/E32/S7', { recursive: true }); writeFileSync(`test-results/epics/E32/S7/sim-perf-${count}.json`, JSON.stringify(proof, null, 2));
    expect(proof.count).toBe(count); expect(proof.chargeTicks).toBe(3600);
    expect(m.state.steps.hold.status).toBe('active'); expect(m.state.states['cure-released']).toBe(false);
    expect(proof.p95).toBeLessThanOrEqual(budget);
  } finally { w.dispose(); }
});
