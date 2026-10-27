import { runLevel, type RunnerLevel } from '../../../tools/sim-runner/levels';
import { stateHash } from '../../../src/sim/world/stateHash';
import { mkdirSync, writeFileSync } from 'node:fs';
mkdirSync('test-results/code-seams-2', { recursive: true });
const results = [];
const levels: RunnerLevel[] = ['L1', 'L4', 'L10'];
for (const level of levels) {
  let hash: string | undefined;
  const report = await runLevel(level, 'complete', 1, undefined, 'auto', undefined, world => { hash = stateHash(world.getState()); });
  results.push({ level, hash, report });
  writeFileSync('test-results/code-seams-2/bots.json', JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ level, hash, completed: report.completed, time: report.time, outcome: report.outcome }));
  if (!hash || !report.completed) process.exitCode = 1;
}
