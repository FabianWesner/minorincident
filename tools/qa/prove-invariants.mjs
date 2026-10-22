import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
const ids = ['accessories', 'seats', 'actors', 'vehicles', 'waves', 'objectives', 'ground', 'load'];
const receipts = [];
for (const id of ids) {
  const start = performance.now();
  const run = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', 'tests/qa/invariants/oracles.test.ts', '-t', `fixture ${id}$`, '--maxWorkers=1', '--configLoader', 'runner', '--no-color'], { env: { ...process.env, QA_INVARIANTS_BREAK_FIXTURE: id }, encoding: 'utf8' });
  const output = `${run.stdout ?? ''}\n${run.stderr ?? ''}`;
  const proved = run.status === 1 && output.includes(`${id} invariant fixture`) && output.includes('expected true to be false');
  receipts.push({ id, exit: run.status, proved, elapsedMs: Math.round(performance.now() - start) });
  console.log(`${id}: ${proved ? 'PROVEN RED' : 'PROOF FAILED'} (exit ${run.status})`);
  if (!proved) console.error(output);
}
mkdirSync('test-results/qa-invariants', { recursive: true });
writeFileSync('test-results/qa-invariants/broken-fixtures.json', JSON.stringify(receipts, null, 2) + '\n');
process.exitCode = receipts.every(r => r.proved) ? 0 : 1;
