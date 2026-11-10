// Diagnostic: time the same passive window under several V8 flag sets with N concurrent copies (the audit runs 4 workers on 4 vCPUs).
// Usage: node --import tsx/esm tools/qa/threat/flag-bench.ts [copies=4] [simSeconds=300] [level=L5]
// Each child prints its wall seconds and native state hash; hashes must be identical across flag sets.
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runLevel, type RunnerLevel } from '../../sim-runner/levels';
import { preset, type ProgressionPreset } from '../../../src/sim/progression/Campaign';
import { stateHash } from '../../../src/sim/world/stateHash';

if (process.env.MI_FLAG_BENCH_CHILD) {
  const [level, seconds, seed] = JSON.parse(process.env.MI_FLAG_BENCH_CHILD) as [RunnerLevel, number, number];
  const campaign = preset(`${level}-default` as ProgressionPreset); campaign.seed = seed; campaign.settings.quality = 'low';
  const started = performance.now(); let hash = '';
  await runLevel(level, 'complete', seed, seconds, 'auto', campaign, undefined, 0, { quality: 'low', passive: true, beforeDispose: world => { hash = stateHash(world.getState()); } });
  process.send!({ seconds: (performance.now() - started) / 1000, hash });
  process.exit(0);
}
const copies = Number(process.argv[2] ?? 4), simSeconds = Number(process.argv[3] ?? 300), level = (process.argv[4] ?? 'L5') as RunnerLevel;
const configs: Record<string, string[]> = {
  base: ['--max-semi-space-size=64'],
  singleGc: ['--max-semi-space-size=64', '--single-threaded-gc'],
  semi128: ['--max-semi-space-size=128'],
  semi128single: ['--max-semi-space-size=128', '--single-threaded-gc'],
  noConcMark: ['--max-semi-space-size=64', '--no-concurrent-marking', '--no-concurrent-sweeping'],
};
const only = process.env.FLAG_BENCH_ONLY?.split(',');
for (const [name, flags] of Object.entries(configs)) {
  if (only && !only.includes(name)) continue;
  const started = performance.now();
  const rows = await Promise.all(Array.from({ length: copies }, (_, i) => new Promise<{ seconds: number; hash: string }>((resolve, reject) => {
    const child = fork(fileURLToPath(import.meta.url), [], { execArgv: [...flags, '--import', 'tsx/esm'],
      env: { ...process.env, MI_FLAG_BENCH_CHILD: JSON.stringify([level, simSeconds, 2 + (i % 2)]) }, stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
    child.once('message', m => resolve(m as { seconds: number; hash: string })); child.once('error', reject);
  })));
  console.log(`[flag-bench] ${name} ${level} ${simSeconds}s x${copies}: wall ${((performance.now() - started) / 1000).toFixed(1)}s; children ${rows.map(r => r.seconds.toFixed(1)).join('/')}; hashes ${rows.map(r => r.hash.slice(0, 8)).join('/')}`);
}
