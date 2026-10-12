import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { SimWorld } from '../../../src/sim/world/SimWorld';
for (const [count, budget] of [[200, 4], [100, 6]] as const) test(`T-E07-11-zoo-s3-${count} @E07-AC11 @E18-AC02 mixed zoo specials stay within ${budget}ms`, async () => {
  const w = new SimWorld();
  try {
    await w.init(); w.loadScenario(count === 200 ? 'perf-horde-200' : 'perf-horde-100');
    const ai = w.infected!, ids: number[] = [];
    for (const [i, old] of ai.active.slice(0, count / 10).entries()) {
      const p = { x: old.transform.x, z: old.transform.z }; ai.release(old); ids.push(ai.spawn(i % 2 ? 'infected.flamingo' : 'infected.zebra', p, { state: 'chase' }));
    }
    let activations = 0; w.events.on('infected.special', ev => { if (ev.type === 'infected.special' && ev.stage === 'active') activations++; });
    const times: number[] = [], p = w.entities.get(1)!;
    for (let tick = 0; tick < 720; tick++) {
      const t = performance.now();
      if (tick % 90 === 0) for (const [i, id] of ids.entries()) {
        const e = w.entities.get(id)!;
        ai.startSpecial(id, i % 2 ? 'flamingo.dive' : tick % 180 ? 'zebra.kick' : 'zebra.stampede', { id: 1, x: p.transform.x, z: p.transform.z }, { x: e.transform.x, z: e.transform.z, radius: 1, dx: 1, dz: 0 });
      }
      w.update(); if (tick >= 120) times.push(performance.now() - t);
      expect(ai.director.count).toBe(count);
    }
    times.sort((a, b) => a - b);
    const proof = { count, zoo: ids.length, activations, simMsP95: times[Math.ceil(times.length * .95) - 1], budgetMs: budget };
    mkdirSync('docs/reports/zoo-s3', { recursive: true }); writeFileSync(`docs/reports/zoo-s3/perf-${count}.json`, JSON.stringify(proof, null, 2) + '\n');
    expect(activations).toBeGreaterThan(0); expect(proof.simMsP95).toBeLessThanOrEqual(budget);
  } finally { w.dispose(); }
});
