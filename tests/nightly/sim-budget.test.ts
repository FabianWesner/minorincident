// Nightly performance measurement with a budget (not a per-change gate): Node sim p95 at the high and low tier caps.
// Wall-clock budgets need a quiet machine; run via `npm run test:nightly`, never next to other heavy jobs.
import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { measureHorde } from '../../tools/performance/sim';

test('sim budget: p95 tick ≤ 4 ms with 200 living infected and ≤ 6 ms with 100 (low tier), no collision failures', async () => {
  const results = [];
  for (const [scenario, count, budget] of [['perf-horde-200', 200, 4], ['perf-horde-100', 100, 6]] as const) {
    const proof = await measureHorde(scenario);
    results.push({ ...proof, scenario, budget });
    expect(proof.minInfected, scenario).toBe(count);
    expect(proof.collision, scenario).toMatchObject({ failures: 0, pending: 0 });
    expect(proof.simMsP95, scenario).toBeLessThanOrEqual(budget);
  }
  mkdirSync('test-results/nightly', { recursive: true });
  writeFileSync('test-results/nightly/sim-budget.json', JSON.stringify(results, null, 2) + '\n');
}, 600_000);
