import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { selectionFor } from './verify-selection';

// The per-epic acceptance audit selected tests by @E<NN>-AC<NN> tags. The test rewrite (PO 10-27,
// docs/qa/test-strategy.md) removed those lane receipts: level and epic correctness is covered by the nightly
// campaign bot (npm run test:nightly), Scene Lab and the Opus visual QA. `npm run verify -- E<NN>` now runs the
// per-change gate (typecheck, lint, the engine/shared suite with its budget) and writes the usual receipt.
const target = process.argv[2];
const selection = selectionFor(target);
const output = `test-results/epics/${target}`;
mkdirSync(output, { recursive: true });
console.log(`[verify] ${target} (${selection.epics.join(', ')}): per-epic AC tests were retired; running the per-change gate.`);
const checks = [['npm', 'run', 'typecheck'], ['npm', 'run', 'lint'], ['npm', 'test']].map(command => {
  const started = Date.now(), result = spawnSync(command[0], command.slice(1), { stdio: 'inherit' });
  return { command: command.join(' '), status: result.status, seconds: (Date.now() - started) / 1000 };
});
writeFileSync(`${output}/checks.json`, JSON.stringify({ target, epics: selection.epics, checks }, null, 2) + '\n');
process.exitCode = checks.every(check => check.status === 0) ? 0 : 1;
