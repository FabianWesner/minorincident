import { expect, test } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { SimWorld } from '../../../src/sim/world/SimWorld';

for (const [count, budget] of [[200, 4], [100, 6]] as const) test(`T-E07-06-support-perf-${count} @E18-AC02 @perf live Alpha support moves stay within ${budget}ms`, async () => {
  const w = new SimWorld();
  try {
    await w.init(); w.loadScenario(count === 200 ? 'perf-horde-200' : 'perf-horde-100'); w.combat!.damage.god = true;
    const ai = w.infected!, ids: number[] = [];
    for (const old of ai.active.slice(0, 6)) {
      const position = { x: old.transform.x, z: old.transform.z }; ai.release(old);
      const id = ai.spawn('infected.alpha', position, { state: 'chase' }); ids.push(id);
      const body = structuredClone(w.entities.get(id)!); body.id = 0; body.archetype = 'infected.runner'; body.health.current = 0; body.corpse = true;
      body.infected!.state = 'dead'; body.infected!.deadAt = -120; body.infected!.recoverAt = -1;
      body.transform.x += 1; w.entities.create(body);
    }
    const times: number[] = [], player = w.entities.get(1)!;
    for (let tick = 0; tick < 720; tick++) {
      const started = performance.now();
      if (tick % 90 === 0) for (const id of ids) {
        const e = w.entities.get(id)!;
        ai.startSpecial(id, Math.floor(tick / 90) % 2 ? 'alpha.grab-throw' : 'alpha.roar', { id: 1, x: player.transform.x, z: player.transform.z }, { x: e.transform.x, z: e.transform.z, radius: 18, dx: 1, dz: 0 });
      }
      w.update(); if (tick >= 120) times.push(performance.now() - started);
    }
    times.sort((a, b) => a - b);
    const proof = { count, alphas: ids.length, countAfter: ai.director.count, simMsP95: times[Math.ceil(times.length * .95) - 1], budgetMs: budget, buffs: w.events.events().filter(e => e.type === 'infected.roar-buff' && e.stage === 'active').length, throws: w.events.events().filter(e => e.type === 'infected.prop-thrown').length };
    mkdirSync('test-results/alpha-s3/perf', { recursive: true }); writeFileSync(`test-results/alpha-s3/perf/sim-${count}.json`, JSON.stringify(proof, null, 2) + '\n');
    expect(proof.countAfter).toBe(count); expect(proof.buffs).toBeGreaterThan(0); expect(proof.throws).toBeGreaterThan(0); expect(proof.simMsP95).toBeLessThanOrEqual(budget);
  } finally { w.dispose(); }
});
