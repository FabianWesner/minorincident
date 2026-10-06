import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { selectionFor } from './verify-selection';

const target = process.argv[2];
const selection = selectionFor(target);
const output = `test-results/epics/${target}`;
mkdirSync(output, { recursive: true });
const commands: string[][] = [
  ['npm', 'run', 'typecheck'], ['npm', 'run', 'lint'], ['npm', 'run', 'build'],
  // Timing fixtures must not compete with other Vitest workers on the shared Mac.
  ['npx', 'vitest', 'run', '-t', selection.pattern, '--maxWorkers=1', '--reporter=default', '--reporter=json', `--outputFile=${output}/vitest.json`],
  ...(target === 'E10'
    ? [
      ['sh', 'tools/e2e-lock.sh', 'npx', 'playwright', 'test', '--grep', selection.pattern, '--grep-invert', '@E10-AC06', '--workers=2'],
      // Native GPU load timing stays headless: run once, after the other browser checks.
      ['sh', 'tools/e2e-lock.sh', 'npx', 'playwright', 'test', 'tests/perf/district-load.spec.ts', '--grep', '@E10-AC06', '--project=chromium', '--workers=2'],
    ]
    : [['sh', 'tools/e2e-lock.sh', 'npx', 'playwright', 'test', '--grep', selection.pattern]]),
];
const checks: { command: string[]; exitCode: number | null }[] = [];
for (const [command, ...args] of commands) {
  console.log(`\nVerifying ${target}: ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { stdio: 'inherit', env: process.env });
  if (target === 'E10' && args.includes('playwright')) copyFileSync('test-results/playwright/results.json', `${output}/playwright-${args.includes('@E10-AC06') && !args.includes('--grep-invert') ? 'gpu' : 'headless'}.json`);
  checks.push({ command: [command, ...args], exitCode: result.status });
  writeFileSync(`${output}/checks.json`, JSON.stringify({ target, ...selection, checks }, null, 2) + '\n');
  if (result.error || result.status !== 0) { process.exitCode = result.status || 1; break; }
}
