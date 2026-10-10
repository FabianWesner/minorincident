import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { loadL1, runL1 } from '../../tools/sim-runner/l1Bots';
import { loadL2, runL2 } from '../../tools/sim-runner/l2Bots';
import { loadL4, runL4 } from '../../tools/sim-runner/l4Bots';
mkdirSync('test-results/closeout', { recursive: true });
for (const [level, load, run] of [['L1', loadL1, runL1], ['L2', loadL2, runL2], ['L4', loadL4, runL4]] as const) {
  const { world, mission } = await load(1);
  try {
    const result = run(world, mission, 'complete', { seed: 1 });
    writeFileSync(`test-results/closeout/${level}-seed1.json`, JSON.stringify(result, null, 2) + '\n');
    assert.equal(result.outcome, 'complete', `${level} complete bot`);
    console.log(`${level}: ${result.outcome}, ${result.simSeconds}s, ${result.deaths} deaths`);
  } finally { world.dispose(); }
}
