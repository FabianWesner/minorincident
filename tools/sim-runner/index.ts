import { missionIds, type MissionId } from '../../src/levels/missions';
import { runLevel, type CompletionPolicy } from './levels';
import { measureHorde } from '../performance/sim';
import { loadL1, runL1, type L1Profile } from './l1Bots';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { SimWorld } from '../../src/sim/world/SimWorld';
import { stateHash } from '../../src/sim/world/stateHash';

/** Run the same world used by the browser; timing is measured outside the sim. */
const { values } = parseArgs({ options: {
  scenario: { type: 'string', default: 'empty' }, ticks: { type: 'string' },
  seed: { type: 'string', default: '1' }, out: { type: 'string' },
  route: { type: 'string' }, level: { type: 'string' }, policy: { type: 'string', default: 'complete' }, seeds: { type: 'string', default: '1' }, 'completion-only': { type: 'boolean', default: false },
} });
const ticks = Number(values.ticks ?? '600'), seed = Number(values.seed);
if (!Number.isSafeInteger(ticks) || ticks < 0 || !Number.isSafeInteger(seed)) throw new RangeError('Ticks must be nonnegative and seed an integer');
if (values.level) {
  if (values.level !== 'all' && !missionIds.includes(values.level as MissionId)) throw new RangeError('Level must be L1–L6 or all');
  if (!['complete', 'newbie'].includes(values.policy!)) throw new RangeError('Policy must be complete or newbie');
  const seeds = Number(values.seeds);
  if (!Number.isSafeInteger(seeds) || seeds <= 0 || !Number.isSafeInteger(seed + seeds - 1)) throw new RangeError('Seeds must be a positive integer');
  if (values.route && !['market', 'park'].includes(values.route)) throw new RangeError('Route must be market or park');
  const reports = [];
  for (const level of values.level === 'all' ? missionIds : [values.level as MissionId]) for (let i = 0; i < seeds; i++) {
    const report = await runLevel(level, values.policy as CompletionPolicy, seed + i, values.ticks === undefined ? 1200 : ticks / 60, values.route as 'market' | 'park' | undefined);
    reports.push(report);
    console.log(JSON.stringify({ level, seed: seed + i, completed: report.completed, time: report.time, deaths: report.deaths, outcome: report.outcome, furthestObjective: report.furthestObjective }));
  }
  const failures: Record<string, number> = {};
  for (const r of reports) for (const [reason, count] of Object.entries(r.failures)) failures[reason] = (failures[reason] ?? 0) + count;
  const report = { completed: reports.filter(r => r.completed).length, runs: reports.length, time: reports.reduce((sum,r) => sum + r.time, 0), deaths: reports.reduce((sum,r) => sum + r.deaths, 0), failures, reports };
  const output = values.out ?? `test-results/sim/${values.level}-${values.policy}.json`;
  await mkdir(dirname(output), { recursive: true }); await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ output, completed: report.completed, runs: report.runs, failures }));
  if (values['completion-only'] && report.completed !== report.runs) process.exitCode = 1;
} else if (values.scenario === 'perf-horde-200' || values.scenario === 'perf-horde-100') {
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
