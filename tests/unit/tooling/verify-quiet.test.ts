import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, test } from 'vitest';

/** Run the real verifier CLI against recording executables; no browsers or nested suites. */
function verify(target: string, failQuiet = false) {
  const dir = mkdtempSync(join(tmpdir(), 'mi-verify-quiet-'));
  try {
    mkdirSync(join(dir, 'bin')); mkdirSync(join(dir, 'specs'));
    writeFileSync(join(dir, 'specs/status.json'), JSON.stringify({ E26: 'in-progress', E28: 'in-progress' }));
    const stub = `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync('commands.jsonl', JSON.stringify(args) + '\\n');
fs.mkdirSync('test-results/playwright', {recursive: true});
fs.writeFileSync('test-results/playwright/results.json', JSON.stringify({quiet: args.includes('tools/perf/quiet-run.sh')}));
process.exit(process.env.MI_STUB_FAIL_QUIET === '1' && args.includes('tools/perf/quiet-run.sh') ? 42 : 0);
`;
    for (const name of ['npm', 'sh']) writeFileSync(join(dir, 'bin', name), stub, { mode: 0o755 });
    const result = spawnSync(process.execPath, [resolve('node_modules/tsx/dist/cli.mjs'), resolve('tools/verify.ts'), target], {
      cwd: dir, env: { ...process.env, PATH: `${join(dir, 'bin')}:${process.env.PATH}`, MI_VERIFY_REMOTE_SIM: '1', MI_STUB_FAIL_QUIET: failQuiet ? '1' : '0' }, encoding: 'utf8',
    });
    const output = join(dir, 'test-results/epics', target);
    return {
      status: result.status,
      checks: JSON.parse(readFileSync(join(output, 'checks.json'), 'utf8')).checks as { command: string[]; exitCode: number }[],
      functional: JSON.parse(readFileSync(join(output, 'playwright-headless.json'), 'utf8')),
      timing: JSON.parse(readFileSync(join(output, 'playwright-gpu.json'), 'utf8')),
    };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

for (const epic of ['E26', 'E28']) test(`${epic} CLI reserves quiet timing separately and retains functional/perf evidence`, () => {
  const result = verify(epic);
  expect(result.status).toBe(0);
  const browser = result.checks.filter(check => check.command.includes('playwright'));
  expect(browser).toHaveLength(2);
  expect(browser[0].command).toContain('--grep-invert'); expect(browser[0].command).toContain('@perf');
  expect(result.functional.quiet).toBe(false); expect(result.timing.quiet).toBe(true);
  const pattern = new RegExp(browser[1].command[browser[1].command.indexOf('--grep') + 1]);
  expect(pattern.test(`fixture @${epic}-AC10 @perf high`)).toBe(true);
  expect(pattern.test(`fixture @${epic}-AC10 functional`)).toBe(false);
  expect(pattern.test('unrelated @E18 @perf')).toBe(false);
  expect(browser.every(check => check.command.includes('--workers=1'))).toBe(true);
});

test('a quiet timing failure keeps the verifier red and records its exit code', () => {
  const result = verify('E28', true);
  expect(result.status).toBe(42);
  expect(result.checks.at(-1)!.exitCode).toBe(42);
});
