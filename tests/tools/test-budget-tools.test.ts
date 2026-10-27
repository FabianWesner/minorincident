import { execFile, spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { expect, test } from 'vitest';
import { parsePlaywrightTotal } from '../../tools/qa/test-budget-count.mjs';

const exec = promisify(execFile);
test('test budget collection is passive, rejects missing counts and bounds collection with child cleanup', async () => {
  expect(parsePlaywrightTotal('Listing tests...\nTotal: 17 tests')).toBe(17);
  expect(() => parsePlaywrightTotal('Listing tests...')).toThrow('did not report a test count');
  const listed = await exec('npx', ['playwright', 'test', '--list', '--project=chromium'], {
    env: { ...process.env, BROWSER_POOL: 'off', MI_BROWSER_POOL: '0' }, timeout: 20_000,
  });
  expect(parsePlaywrightTotal(listed.stdout)).toBeGreaterThan(0);
  const root = mkdtempSync(join(tmpdir(), 'mi-budget-fixture-'));
  try {
    const npx = join(root, 'npx');
    const run = (mode: string, seconds: string) => spawnSync(process.execPath,
      [process.env.MI_BUDGET_RUNNER ?? resolve('tools/qa/test-budget.mjs'), '--name', 'budget-fixture', '--max-seconds', seconds, '--', process.execPath, '-e', ''],
      { env: { ...process.env, PATH: `${root}:${process.env.PATH}`, BUDGET_FIXTURE_MODE: mode, BUDGET_FIXTURE_PID: join(root, 'pid') }, encoding: 'utf8', timeout: 12_000 });
    writeFileSync(npx, `#!/usr/bin/env node
const fs = require('node:fs');
if (process.env.BUDGET_FIXTURE_MODE === 'hang') {
  fs.writeFileSync(process.env.BUDGET_FIXTURE_PID, String(process.pid));
  process.on('SIGTERM', () => {}); setInterval(() => {}, 1000);
} else {
  if (process.env.BUDGET_FIXTURE_MODE === 'delay') Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 300);
  const out = process.argv.find(arg => arg.startsWith('--json='));
  if (out) fs.writeFileSync(out.slice(7), '[]');
  else console.log(process.env.BUDGET_FIXTURE_MODE === 'malformed' ? 'No total line' : 'Total: 1 test');
}
`); chmodSync(npx, 0o755);
    const malformed = run('malformed', '10');
    expect(malformed.status, 'unparseable collection must fail').toBe(1);
    expect(malformed.stderr).toContain('did not report a test count');
    expect(run('delay', '.1').status, 'collection time consumes the wrapper budget').toBe(1);
    const hung = run('hang', '.1');
    expect(hung.error, 'watchdog must return before the outer fixture timeout').toBeUndefined();
    expect(hung.status, 'hung collection fails').toBe(1);
    const pid = Number(readFileSync(join(root, 'pid'), 'utf8'));
    expect(() => process.kill(pid, 0), 'timed-out collector must be reaped').toThrow();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 30_000);
