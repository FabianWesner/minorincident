import { execFile, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
    const vitestCli = join(root, 'vitest.cjs');
    const run = (mode: string, seconds: string) => {
      const result = spawnSync(process.execPath,
      [process.env.MI_BUDGET_RUNNER ?? resolve('tools/qa/test-budget.mjs'), '--name', 'budget-fixture', '--max-seconds', seconds, '--', process.execPath, '-e', ''],
      { env: { ...process.env, MI_TEST_BUDGET_VITEST_CLI: vitestCli, MI_TEST_BUDGET_PLAYWRIGHT_CLI: vitestCli, BUDGET_FIXTURE_MODE: mode, BUDGET_FIXTURE_PID: join(root, 'pid'), BUDGET_FIXTURE_ORPHAN_PID: join(root, 'orphan-pid') }, encoding: 'utf8', timeout: 35_000 });
      const collectedDir = join(root, 'list-dir');
      expect(existsSync(readFileSync(collectedDir, 'utf8')), `${mode}: collection temp directory must be removed`).toBe(false);
      return result;
    };
    writeFileSync(vitestCli, `
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const path = require('node:path');
const out = process.argv.find(arg => arg.startsWith('--json='));
if (out) fs.writeFileSync(path.join(path.dirname(process.env.BUDGET_FIXTURE_PID), 'list-dir'), path.dirname(out.slice(7)));
if (['hang', 'kill-parent', 'kill-watchdog'].includes(process.env.BUDGET_FIXTURE_MODE)) {
  fs.writeFileSync(process.env.BUDGET_FIXTURE_PID, String(process.pid));
  process.on('SIGTERM', () => {});
  if (process.env.BUDGET_FIXTURE_MODE === 'kill-parent') process.kill(Number(process.env.MI_TEST_BUDGET_PROCESS_PID), 'SIGTERM');
  if (process.env.BUDGET_FIXTURE_MODE === 'kill-watchdog') process.kill(process.ppid, 'SIGTERM');
  setInterval(() => {}, 1000);
} else {
  if (process.env.BUDGET_FIXTURE_MODE === 'orphan' && process.argv.some(arg => arg.startsWith('--json='))) {
    const child = spawn(process.execPath, ['-e', "process.on('SIGTERM',()=>{});setInterval(()=>{},1000)", process.env.BUDGET_FIXTURE_ORPHAN_PID], { stdio: 'ignore' });
    child.unref();
    fs.writeFileSync(process.env.BUDGET_FIXTURE_ORPHAN_PID, String(child.pid));
  }
  if (process.env.BUDGET_FIXTURE_MODE === 'delay') Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 300);
  if (out) fs.writeFileSync(out.slice(7), '[]');
  else console.log(process.env.BUDGET_FIXTURE_MODE === 'malformed' ? 'No total line' : 'Total: 1 test');
}
`);
    const malformed = run('malformed', '10');
    expect(malformed.status, 'unparseable collection must fail').toBe(1);
    expect(malformed.stderr).toContain('did not report a test count');
    expect(run('orphan', '10').status, 'successful wrapper still cleans its process group').toBe(0);
    const orphanPid = Number(readFileSync(join(root, 'orphan-pid'), 'utf8'));
    expect(() => process.kill(orphanPid, 0), 'successful collector must not leave grandchildren').toThrow();
    expect(run('delay', '.1').status, 'collection time consumes the wrapper budget').toBe(1);
    const hung = run('hang', '.1');
    expect(hung.error, 'watchdog must return before the outer fixture timeout').toBeUndefined();
    expect(hung.status, 'hung collection fails').toBe(1);
    const pid = Number(readFileSync(join(root, 'pid'), 'utf8'));
    expect(() => process.kill(pid, 0), 'timed-out collector must be reaped').toThrow();
    const killed = run('kill-parent', '5');
    expect(killed.status, 'the collector must forward TERM, clean up and preserve signal status').toBe(143);
    const killedPid = Number(readFileSync(join(root, 'pid'), 'utf8'));
    expect(() => process.kill(killedPid, 0), 'killed watchdog must reap its process group').toThrow();
    expect(run('kill-watchdog', '10').status, 'watchdog cancellation must fail collection').toBe(1);
    const watchdogChild = Number(readFileSync(join(root, 'pid'), 'utf8'));
    expect(() => process.kill(watchdogChild, 0), 'cancelled watchdog must reap its process group').toThrow();
  } finally {
    // Failed assertions must not themselves leave the regression fixture alive.
    for (const name of ['pid', 'orphan-pid']) {
      if (!existsSync(join(root, name))) continue;
      const pid = Number(readFileSync(join(root, name), 'utf8'));
      const command = spawnSync('ps', ['-p', String(pid), '-o', 'command='], { encoding: 'utf8' }).stdout;
      if (command?.includes(root)) { try { process.kill(pid, 'SIGKILL'); } catch { /* already exited */ } }
    }
    rmSync(root, { recursive: true, force: true });
  }
}, 60_000);
