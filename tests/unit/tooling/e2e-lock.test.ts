import { spawn, execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';

const exec = promisify(execFile), script = resolve('tools/e2e-lock.sh'), dirs: string[] = [];
function environment(units = '1') {
  const dir = mkdtempSync(`${tmpdir()}/mi-capacity-test-`); dirs.push(dir);
  writeFileSync(`${dir}/python3`, '#!/bin/sh\ncase \"$1\" in *mac-gpu-guard.py) exit 0;; esac\nexec /usr/bin/python3 \"$@\"\n'); chmodSync(`${dir}/python3`, 0o755);
  return { dir, env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, MI_E2E_LOCK_HELD: '', MI_E2E_UNITS_HELD: '', E2E_LOCK: `${dir}/lock`, E2E_SLOTS: '3', E2E_UNITS: units } };
}
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
describe.skipIf(process.platform !== 'darwin')('machine browser capacity', () => {
  it('reserves units across concurrent jobs and releases them for waiting jobs', async () => {
    const { dir, env } = environment(), log = `${dir}/events`;
    const code = String.raw`const fs=require('fs');const units=Number(process.env.MI_E2E_UNITS_HELD);fs.appendFileSync(process.argv[1],JSON.stringify({units})+'\n');setTimeout(()=>fs.appendFileSync(process.argv[1],JSON.stringify({units:-units})+'\n'),150)`;
    const completed = await Promise.allSettled([2, 1, 2, 1, 1, 2].map(units => exec('sh', [script, process.execPath, '-e', code, log], { env: { ...env, E2E_UNITS: String(units) }, timeout: 15_000 })));
    for (const run of completed) expect(run.status, run.status === 'rejected' ? String(run.reason) : undefined).toBe('fulfilled');
    let active = 0, peak = 0;
    const events = readFileSync(log, 'utf8').trim().split('\n').map(line => JSON.parse(line) as { units: number });
    expect(events).toHaveLength(12);
    for (const { units } of events) { active += units; peak = Math.max(peak, active); expect(active).toBeGreaterThanOrEqual(0); expect(active).toBeLessThanOrEqual(2); }
    expect(peak).toBe(2); expect(active).toBe(0);
  }, 20_000);

  it('returns a child exit 75 exactly once and preserves its stderr', async () => {
    const { dir, env } = environment();
    const result = await new Promise<{ code: number | null; stderr: string }>((resolve, reject) => {
      const child = spawn('sh', [script, 'sh', '-c', 'printf x >> "$1"; printf diagnostic >&2; exit 75', 'sh', `${dir}/starts`], { env });
      let stderr = ''; child.stderr.on('data', chunk => { stderr += chunk; });
      child.on('error', reject); child.on('close', code => resolve({ code, stderr }));
    });
    expect(result).toEqual({ code: 75, stderr: 'diagnostic' });
    expect(readFileSync(`${dir}/starts`, 'utf8')).toBe('x');
  });

  it('charges the Playwright worker count, including separated CLI arguments', async () => {
    const { dir, env } = environment();
    writeFileSync(`${dir}/playwright`, '#!/bin/sh\nprintf "%s" "$MI_E2E_UNITS_HELD"\n'); chmodSync(`${dir}/playwright`, 0o755);
    const options = { env: { ...env, E2E_UNITS: '', PATH: `${dir}:${process.env.PATH}` } };
    for (const [args, expected] of [[[], '2'], [['--workers=1'], '1'], [['--workers', '2'], '2']] as const) {
      expect((await exec('sh', [script, 'playwright', ...args], options)).stdout).toBe(expected);
    }
    expect((await exec('sh', [script, `${dir}/playwright`], options)).stdout).toBe('2');
    await expect(exec('sh', [script, 'playwright', '--workers=3'], options)).rejects.toMatchObject({ code: 2 });
  });

  it('rejects undersized and invalid reservations before launching a command', async () => {
    const { env } = environment();
    await expect(exec('sh', [script, 'playwright', '--workers=2'], { env })).rejects.toMatchObject({ code: 2 });
    await expect(exec('sh', [script, 'true'], { env: { ...env, E2E_UNITS: '0' } })).rejects.toMatchObject({ code: 2 });
    await expect(exec('sh', [script, 'true'], { env: { ...env, E2E_SLOTS: '1', E2E_UNITS: '2' } })).rejects.toMatchObject({ code: 2 });
  });

  it('allows nesting within a reservation and rejects expansion', async () => {
    const { env } = environment();
    expect((await exec('sh', [script, 'sh', script, 'printf', 'nested'], { env })).stdout).toBe('nested');
    await expect(exec('sh', [script, 'env', 'E2E_UNITS=2', 'sh', script, 'true'], { env })).rejects.toMatchObject({ code: 2 });
  });

  it('does not use a legacy third slot when E2E_SLOTS exceeds two', async () => {
    const { env } = environment('2');
    const blocker = spawn('lockf', ['-k', `${env.E2E_LOCK}.1`, 'sh', '-c', 'printf ready; cat >/dev/null'], { stdio: ['pipe', 'pipe', 'pipe'] });
    try {
      await new Promise<void>((resolve, reject) => { blocker.stdout.once('data', () => resolve()); blocker.once('error', reject); });
      await expect(exec('sh', [script, 'printf', 'paired'], { env, timeout: 500 })).rejects.toMatchObject({ killed: true });
    } finally { blocker.stdin.end(); await new Promise<void>(resolve => blocker.once('close', () => resolve())); }
  });

  it('quiet-run covers the legacy fourth slot even with E2E_SLOTS=1', async () => {
    const { dir, env } = environment();
    // Stub only the unrelated host-load checks; exercise real kernel locks in a private namespace.
    writeFileSync(`${dir}/python3`, '#!/bin/sh\ncase \"$1\" in *mac-gpu-guard.py) exit 0;; esac\nexec /usr/bin/python3 \"$@\"\n'); chmodSync(`${dir}/python3`, 0o755);
    writeFileSync(`${dir}/pgrep`, '#!/bin/sh\nexit 1\n'); chmodSync(`${dir}/pgrep`, 0o755);
    writeFileSync(`${dir}/node`, '#!/bin/sh\ncase "$*" in *process.exit*loadavg*) exit 0;; esac\nexec "$MI_TEST_NODE_BIN" "$@"\n'); chmodSync(`${dir}/node`, 0o755);
    const blocker = spawn('lockf', ['-k', `${env.E2E_LOCK}.3`, 'sh', '-c', 'printf ready; cat >/dev/null'], { stdio: ['pipe', 'pipe', 'pipe'] });
    try {
      await new Promise<void>((resolve, reject) => { blocker.stdout.once('data', () => resolve()); blocker.once('error', reject); });
      let admitted = false;
      const quiet = exec('sh', ['tools/perf/quiet-run.sh', 'printf', 'admitted'], { env: { ...env, E2E_SLOTS: '1', MI_PERF_LOCK_HELD: '', MI_TEST_NODE_BIN: process.execPath, PERF_CONDITIONS_LOG: `${dir}/conditions`, PATH: `${dir}:${process.env.PATH}` }, timeout: 5000 }).then(result => { admitted = true; return result; });
      await new Promise(resolve => setTimeout(resolve, 200));
      expect(admitted).toBe(false);
      blocker.stdin.end();
      expect((await quiet).stdout).toContain('admitted');
      expect(JSON.parse(readFileSync(`${dir}/conditions`, 'utf8')).browserSlots).toEqual([0, 1, 2, 3]);
    } finally { blocker.stdin.end(); if (blocker.exitCode === null) await new Promise<void>(resolve => blocker.once('close', () => resolve())); }
  });
});
