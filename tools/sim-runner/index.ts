import { measureHorde } from '../performance/sim';
import { loadL1, runL1, type L1Profile } from './l1Bots';
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
if (values.scenario === 'perf-horde-200' || values.scenario === 'perf-horde-100') {
  const measurement = await measureHorde(values.scenario, ticks, seed);
  const output = values.out ?? `test-results/sim/${values.scenario}-seed-${seed}.json`;
  const report = { outcome: 'tick-budget', ...measurement, maxConcurrentInfected: measurement.cap };
  await mkdir(dirname(output), { recursive: true }); await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ output, ...report }));
} else if (/^l1-(complete|newbie|idle|evade-only)$/.test(values.scenario!)) {
  // L1 v2 bot playthrough: `npm run sim -- --scenario l1-complete --seed 3 [--ticks <max sim ticks>]`.
  const profile = values.scenario!.slice(3) as L1Profile, { world, mission } = await loadL1(seed);
  try {
    const started = performance.now(), report = runL1(world, mission, profile, { seed, maxSeconds: ticks === 600 ? 900 : ticks / 60 });
    const output = values.out ?? `test-results/sim/${values.scenario}-seed-${seed}.json`;
    await mkdir(dirname(output), { recursive: true }); await writeFile(output, JSON.stringify({ ...report, ticks: world.tick, wallMs: Math.round(performance.now() - started), stateHash: stateHash(world.getState()) }, null, 2) + '\n');
    console.log(JSON.stringify({ output, outcome: report.outcome, simSeconds: report.simSeconds, deaths: report.deaths, maxInfected: report.maxInfected }));
  } finally { world.dispose(); }
} else {
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
}
