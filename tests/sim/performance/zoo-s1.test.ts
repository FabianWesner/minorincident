import { expect, test } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { SimWorld } from '../../../src/sim/world/SimWorld';

for (const [count, budget] of [[200, 4], [100, 6]] as const) test(`T-E07-11-zoo-s1-${count} @E07-AC11 @E18-AC02 mixed horde and actual zoo moves stay within ${budget}ms`, async () => {
  const w = new SimWorld();
  try {
    await w.init(); w.loadScenario(count === 200 ? 'perf-horde-200' : 'perf-horde-100');
    const ai = w.infected!, ids: number[] = [];
    const species = ['infected.lion', 'infected.gorilla'] as const;
    for (const old of ai.active.slice(0, count / 5)) {
      const p = { x: old.transform.x, z: old.transform.z }; ai.release(old);
      ids.push(ai.spawn(species[ids.length % 2], p, { state: 'chase' }));
    }
    let activations = 0;
    w.events.on('infected.special', ev => { if (ev.type === 'infected.special' && ev.stage === 'active') activations++; });
    const times: number[] = [], player = w.entities.get(1)!;
    const moves = [['lion.pounce', 'gorilla.pound'], ['lion.flank', 'gorilla.roar']] as const;
    let minInfected: number = count;
    for (let tick = 0; tick < 720; tick++) {
      const start = performance.now();
      if (tick % 90 === 0) for (const id of ids) ai.startSpecial(id, moves[Math.floor(tick / 90) % 2][ids.indexOf(id) % 2], { id: 1, x: player.transform.x, z: player.transform.z }, { x: player.transform.x, z: player.transform.z, radius: 4, dx: 1, dz: 0 });
      w.update();
      if (tick >= 120) times.push(performance.now() - start);
      minInfected = Math.min(minInfected, ai.director.count);
    }
    times.sort((a, b) => a - b);
    const proof = { count, animals: ids.length, minInfected, activations, cap: ai.director.cap, ticks: times.length, simMsP95: times[Math.ceil(times.length * .95) - 1], budgetMs: budget };
    mkdirSync('test-results/zoo-s1', { recursive: true }); writeFileSync(`test-results/zoo-s1/perf-${count}.json`, JSON.stringify(proof, null, 2) + '\n');
    expect(activations).toBeGreaterThan(0); expect(minInfected).toBe(count); expect(proof.simMsP95).toBeLessThanOrEqual(budget);
  } finally { w.dispose(); }
});
