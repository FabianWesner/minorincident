import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { selectionFor } from './verify-selection';

const target = process.argv[2];
const selection = selectionFor(target);
const output = `test-results/epics/${target}`;
mkdirSync(output, { recursive: true });
const commands: string[][] = [
  ['npm', 'run', 'typecheck'], ['npm', 'run', 'lint'], ['npm', 'run', 'build'],
  ['npx', 'vitest', 'run', '-t', selection.pattern, '--reporter=default', '--reporter=json', `--outputFile=${output}/vitest.json`],
  ['sh', 'tools/e2e-lock.sh', 'npx', 'playwright', 'test', '--grep', selection.pattern], // one browser run at a time per machine
];
const checks: { command: string[]; exitCode: number | null }[] = [];
for (const [command, ...args] of commands) {
  console.log(`\nVerifying ${target}: ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { stdio: 'inherit', env: process.env });
  checks.push({ command: [command, ...args], exitCode: result.status });
  writeFileSync(`${output}/checks.json`, JSON.stringify({ target, ...selection, checks }, null, 2) + '\n');
  if (result.error || result.status !== 0) { process.exitCode = result.status || 1; break; }
}
