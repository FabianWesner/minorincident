import { expect, test } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { measureHorde } from '../../../tools/performance/sim';
for (const [scenario, count, budget] of [['perf-horde-200', 200, 4], ['perf-horde-100', 100, 6]] as const) {
  test(`T-E18-02-${count} @E18-AC02 @perf Node sim p95 ${count} living infected <= ${budget}ms`, async () => {
    const proof = await measureHorde(scenario);
    mkdirSync('test-results/epics/E18', { recursive: true }); writeFileSync(`test-results/epics/E18/sim-${count}.json`, JSON.stringify(proof, null, 2) + '\n');
    expect(proof.minInfected).toBe(count); expect(proof.cap).toBe(count); expect(proof.simMsP95).toBeLessThanOrEqual(budget);
  });
}
test('T-E18-tier-cap @E18-AC04 degradation keeps existing infected and caps future spawns without awarding kills', async () => {
  const { SimWorld } = await import('../../../src/sim/world/SimWorld'); const world = new SimWorld();
  try {
    await world.init(); world.loadScenario('perf-horde-200');
    const before = world.events.events().filter(e => e.type === 'combat.kill').length;
    world.infected!.director.setTier('low');
    expect(world.infected!.director.count).toBe(200); expect(world.infected!.director.cap).toBe(100); expect(world.infected!.director.queue).toHaveLength(0);
    expect(world.events.events().filter(e => e.type === 'combat.kill')).toHaveLength(before);
  } finally { world.dispose(); }
});
