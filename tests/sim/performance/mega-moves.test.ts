import { expect, test } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import { megaAlpha } from '../../../src/data/megaAlpha';

for (const [count, budget] of [[200, 4], [100, 6]] as const) test(`T-E32-11-perf-${count} @E32-AC11 @E18-AC02 Mega specials in a full mixed horde stay inside E18`, async () => {
  const w = new SimWorld();
  try {
    await w.init(); w.loadScenario(count === 200 ? 'perf-horde-200' : 'perf-horde-100');
    w.combat!.damage.god = true;
    const ai = w.infected!, player = w.entities.get(1)!.transform;
    ai.release(ai.active[0]);
    // Start a real close encounter; an idle Alpha facing away never sees the player in this fixture.
    const id = ai.spawn('infected.alpha', { x: player.x - 8, z: player.z }, { state: 'chase' }), e = w.entities.get(id)!;
    e.infected!.pursuit = true; e.health = { current: megaAlpha.hp, max: megaAlpha.hp }; e.combat!.radius = megaAlpha.radius;
    const times: number[] = []; let activations = 0;
    w.events.on('infected.special', ev => { if (ev.type === 'infected.special' && ev.sourceId === id && ev.stage === 'active') activations++; });
    for (let tick = 0; tick < 900; tick++) {
      const start = performance.now(); w.update(); if (tick >= 120) times.push(performance.now() - start);
    }
    times.sort((a, b) => a - b);
    const proof = { count, activations, simMsP95: times[Math.ceil(times.length * .95) - 1], budgetMs: budget, infected: ai.director.count };
    mkdirSync('test-results/epics/E32', { recursive: true }); writeFileSync(`test-results/epics/E32/mega-moves-perf-${count}.json`, JSON.stringify(proof, null, 2) + '\n');
    expect(activations).toBeGreaterThan(0); expect(proof.infected).toBe(count); expect(proof.simMsP95).toBeLessThanOrEqual(budget);
  } finally { w.dispose(); }
});
