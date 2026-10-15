import { mkdirSync, writeFileSync } from 'node:fs';
import { runLevel } from '../sim-runner/levels';

// PO #37: same seed and ordinary bot inputs, before/after the player weapon change.
// Use the library: the CLI's missionIds omits L7, which runLevel supports explicitly.
const variant = process.argv[2] ?? 'after';
if (!['baseline', 'after'].includes(variant)) throw new Error('Expected baseline or after');
const policy = process.argv[3] ?? 'newbie', only = process.argv[4];
if (policy !== 'newbie' && policy !== 'complete') throw new Error('Expected newbie or complete');
const levels = ['L5', 'L6', 'L7', 'L8', 'L9', 'L10'] as const;
if (only && !levels.some(level => level === only)) throw new Error('Expected L5–L10');
const dir = `test-results/shotgun-power/${variant}`;
mkdirSync(dir, { recursive: true });
for (const level of levels.filter(level => !only || level === only)) {
  const report = await runLevel(level, policy, 1);
  writeFileSync(`${dir}/${level}${policy === 'newbie' ? '' : '-complete'}.json`, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ level, completed: report.completed, time: report.time, deaths: report.deaths, outcome: report.outcome }));
}
