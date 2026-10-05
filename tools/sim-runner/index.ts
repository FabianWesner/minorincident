import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { SimWorld } from '../../src/sim/world/SimWorld';
import { stateHash } from '../../src/sim/world/stateHash';

/** Run the same world used by the browser; timing is measured outside the sim. */
const { values } = parseArgs({ options: {
  scenario: { type: 'string', default: 'empty' }, ticks: { type: 'string', default: '600' },
  seed: { type: 'string', default: '1' }, out: { type: 'string' },
} });
const ticks = Number(values.ticks), seed = Number(values.seed);
if (!Number.isSafeInteger(ticks) || ticks < 0 || !Number.isSafeInteger(seed)) throw new RangeError('Ticks must be nonnegative and seed an integer');
const world = new SimWorld();
try {
  await world.init(); world.loadScenario(values.scenario!, seed);
  const times: number[] = [];
  for (let i = 0; i < ticks; i++) {
    const start = performance.now(); world.update(); times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  const report = { outcome: 'tick-budget', ticks: world.tick, seed, stateHash: stateHash(world.getState()), simMsP95: times[Math.max(0, Math.ceil(times.length * 0.95) - 1)] ?? 0,
    deaths: 0, damageTaken: 0, kills: 0, objectiveTimeline: [], maxConcurrentInfected: 0 };
  const output = values.out ?? `test-results/sim/${values.scenario}-seed-${seed}.json`;
  await mkdir(dirname(output), { recursive: true }); await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ output, ...report }));
} finally { world.dispose(); }
