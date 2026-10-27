// Shared gate tools: browser/runner admission is used by every lane and gate. If it breaks, the Mac overloads
// (WindowServer kills, see docs/process/lessons-learned.md) or remote runs lose their caches.
import { execFile, execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, expect, test } from 'vitest';
import { backoffAdmission } from '../../tools/browser-pool/host';

const exec = promisify(execFile), dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

test.skipIf(process.platform !== 'darwin')('e2e-lock legacy fallback (E2E_LEGACY=1): units are reserved across concurrent jobs, never exceed two GPU browsers, and invalid reservations are refused', async () => {
  const dir = mkdtempSync(`${tmpdir()}/mi-capacity-test-`); dirs.push(dir);
  writeFileSync(`${dir}/python3`, '#!/bin/sh\ncase "$1" in *mac-gpu-guard.py) exit 0;; esac\nexec /usr/bin/python3 "$@"\n'); chmodSync(`${dir}/python3`, 0o755);
  const script = resolve('tools/e2e-lock.sh'), log = `${dir}/events`;
  const env = { ...process.env, E2E_LEGACY: '1', PATH: `${dir}:${process.env.PATH}`, MI_E2E_LOCK_HELD: '', MI_E2E_UNITS_HELD: '', E2E_LOCK: `${dir}/lock`, E2E_SLOTS: '3', E2E_UNITS: '1' };
  const code = String.raw`const fs=require('fs');const units=Number(process.env.MI_E2E_UNITS_HELD);fs.appendFileSync(process.argv[1],JSON.stringify({units})+'\n');setTimeout(()=>fs.appendFileSync(process.argv[1],JSON.stringify({units:-units})+'\n'),150)`;
  const completed = await Promise.allSettled([2, 1, 2, 1, 1, 2].map(units => exec('sh', [script, process.execPath, '-e', code, log], { env: { ...env, E2E_UNITS: String(units) }, timeout: 15_000 })));
  for (const run of completed) expect(run.status, run.status === 'rejected' ? String(run.reason) : undefined).toBe('fulfilled');
  let active = 0, peak = 0;
  for (const { units } of readFileSync(log, 'utf8').trim().split('\n').map(line => JSON.parse(line) as { units: number })) { active += units; peak = Math.max(peak, active); expect(active).toBeLessThanOrEqual(2); }
  expect(peak).toBe(2); expect(active).toBe(0);
  await expect(exec('sh', [script, 'playwright', '--workers=3'], { env: { ...env, E2E_UNITS: '' } })).rejects.toMatchObject({ code: 2 });
  await expect(exec('sh', [script, 'true'], { env: { ...env, E2E_UNITS: '0' } })).rejects.toMatchObject({ code: 2 });
  expect((await exec('sh', [script, 'sh', script, 'printf', 'nested'], { env })).stdout).toBe('nested');
}, 30_000);

test('browser pool admission backs off under WindowServer pressure, keeps a one-context floor, recovers only after three cool samples', () => {
  let state = { limit: 4, coolSamples: 0 };
  expect([61, 80, 90, 120].map(cpu => { state = backoffAdmission(state, 4, cpu); return state.limit; })).toEqual([3, 2, 1, 1]);
  state = { limit: 2, coolSamples: 0 };
  expect([15, 15, 40, 15, 15, 15].map(cpu => { state = backoffAdmission(state, 4, cpu); return state.limit; })).toEqual([2, 2, 2, 2, 2, 3]);
  for (const cpu of [NaN, Infinity, -1]) expect(backoffAdmission({ limit: 4, coolSamples: 2 }, 4, cpu)).toEqual({ limit: 1, coolSamples: 0 });
  // Native timing waits for concurrent Vitest/tsc runs (relative and absolute node_modules paths).
  const quiet = new RegExp(readFileSync('tools/perf/quiet-run.sh', 'utf8').match(/! pgrep -f '([^']*node_modules[^']*)'/)![1]);
  for (const command of ['node node_modules/.bin/vitest run tests/engine', '/usr/bin/node node_modules/typescript/bin/tsc --noEmit']) expect(quiet.test(command), command).toBe(true);
  expect(quiet.test('node tools/qa/census.ts')).toBe(false);
});

// Exercise the real runner with a tiny catalog subprocess; no browser is launched.
function gateFixture() {
  const root = mkdtempSync(join(tmpdir(), 'mi-gate-runner-')); dirs.push(root);
  for (const dir of ['tools/scenelab', 'specs/scenes/catalog']) mkdirSync(join(root, dir), { recursive: true });
  writeFileSync(join(root, 'tools/scenelab/catalog.ts'), '// fixture catalog');
  for (const scene of ['alpha', 'beta', 'gamma', 'delta']) writeFileSync(join(root, `specs/scenes/catalog/${scene}.json`), '{}');
  const select = (scenes: string[], backends = scenes.map(() => 'webgl2'), known = {}) => writeFileSync(join(root, 'specs/scenes/gate-list.json'), JSON.stringify({ rows: scenes.map((scene, i) => ({ scene, backend: backends[i], tier: 'high', zoom: null })), known }));
  select(['alpha', 'beta']);
  writeFileSync(join(root, 'tools/e2e-lock.sh'), '#!/bin/sh\nexec node tools/child.mjs "$@"\n');
  writeFileSync(join(root, 'tools/child.mjs'), `
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
const args = process.argv.slice(2), flag = name => args[args.lastIndexOf('--' + name) + 1];
appendFileSync('calls.log', flag('backend') + '\\n');
const mode = process.env.CHILD_BEHAVIOR;
if (mode === 'startup') process.exit(2);
if (mode === 'timeout') process.exit(124);
if (mode === 'signal') process.kill(process.pid, 'SIGTERM');
const out = flag('out'); mkdirSync(out, { recursive: true });
let rows = flag('only').split(',').map(name => ({ name, pass: mode !== 'known' && flag('backend') !== process.env.FAIL_BACKEND, failed: ['fixture'] }));
if (mode === 'incomplete') rows = rows.slice(0, 1);
if (mode === 'wrong-types') rows = rows.map(row => ({ ...row, pass: 'false' }));
writeFileSync(out + '/index.json', mode === 'malformed' ? '{' : JSON.stringify({ rows }));
process.exit(mode === 'bad-exit' ? 2 : rows.some(r => !r.pass) ? 1 : 0);
`);
  const git = (...args: string[]) => execFileSync('git', ['-c', 'user.name=Gate fixture', '-c', 'user.email=gate@example.invalid', '-c', 'core.hooksPath=/dev/null', ...args], { cwd: root, encoding: 'utf8' });
  git('init', '-q'); git('add', '.'); git('commit', '-qm', 'fixture');
  const run = (args: string[] = [], env: Record<string, string> = {}, mode = 'gate') => spawnSync(process.execPath,
    ['--import', resolve('node_modules/tsx/dist/loader.mjs'), process.env.MI_GATE_RUNNER ?? resolve('tools/scenelab/gate-run.ts'), mode, '--out', 'output', ...args],
    { cwd: root, env: { ...process.env, ...env }, encoding: 'utf8', timeout: 10_000 });
  const calls = () => existsSync(join(root, 'calls.log')) ? readFileSync(join(root, 'calls.log'), 'utf8').trim().split('\n').length : 0;
  return { root, run, git, select, calls };
}

test('scene gate resume requires identical rows, revision and backend identities', () => {
  const f = gateFixture();
  expect(f.run().status, 'first run').toBe(0);
  expect(f.run(['--resume']).status, 'identical resume').toBe(0); expect(f.calls()).toBe(1);
  f.git('commit', '--allow-empty', '-qm', 'new revision');
  expect(f.run(['--resume']).status, 'changed revision').toBe(0); expect(f.calls(), 'new revision cannot reuse old passing state').toBe(2);
  f.select(['gamma', 'delta']);
  expect(f.run(['--resume']).status, 'same count, different rows').toBe(0); expect(f.calls()).toBe(3);
  writeFileSync(join(f.root, 'specs/scenes/catalog/gamma.json'), '{"changed":true}');
  expect(f.run(['--resume']).status, 'changed scene config').toBe(0); expect(f.calls()).toBe(4);
  f.select(['alpha', 'alpha'], ['webgpu', 'webgl2']);
  expect(f.run([], { FAIL_BACKEND: 'webgpu' }).status, 'same name on different backends cannot mask a failure').toBe(1);
});

test('scene gate rejects invalid arguments and empty selections before running children', () => {
  const f = gateFixture();
  for (const args of [
    ['--batch', 'NaN'], ['--batch', 'Infinity'], ['--batch', '0'], ['--batch', '-1'], ['--batch', '1.5'],
    ['--shard', '0/2'], ['--shard', '3/2'], ['--shard', '1/0'], ['--shard', '1/NaN'], ['--shard', '2/2'],
  ]) expect(f.run(args).status, args.join(' ')).not.toBe(0);
  expect(f.run([], {}, 'other').status, 'unknown mode').not.toBe(0);
  expect(f.calls(), 'invalid input must not launch work').toBe(0);
  expect(f.run(['--batch', '1', '--shard', '1/2']).status, 'valid shard').toBe(0);
  f.select([]); expect(f.run().status, 'empty selection').not.toBe(0);
});

test('remote runner cache GC removes inactive caches while keeping the current cache and live jobs', () => {
  const root = mkdtempSync(join(tmpdir(), 'mi-cache-gc-')); dirs.push(root);
  const ws = join(root, 'ws'), jobs = join(root, 'jobs'), proc = join(root, 'proc');
  const current = join(ws, 'current'), stale = join(ws, 'stale'), active = join(ws, 'active'), liveJob = join(jobs, 'active-456');
  const age = new Date(Date.now() - 3 * 3600_000);
  for (const dir of [current, stale, active, join(jobs, 'stale-123'), liveJob, join(proc, '42')]) { mkdirSync(dir, { recursive: true }); utimesSync(dir, age, age); }
  symlinkSync(liveJob, join(proc, '42', 'cwd'));
  const source = readFileSync('tools/remote/run.sh', 'utf8');
  const assignment = source.split('\n').find(line => line.startsWith('GC='))!.replaceAll('/srv/mi/ws', ws).replaceAll('/srv/mi/jobs', jobs).replaceAll('/proc/', `${proc}/`);
  const quote = source.split('\n').find(line => line.startsWith('sq()'))!;
  const stat = process.platform === 'darwin' ? 'stat() { shift 2; command stat -f %m "$@"; }\n' : '';
  const shell = `${stat}df() { printf 'Filesystem blocks used available capacity mount\\nfixture 30000000 1000000 29000000 4%% /\\n'; }\n${quote}\nCACHE=$1\n${assignment}\neval "$GC"`;
  execFileSync('sh', ['-c', shell, 'sh', current]);
  expect(existsSync(stale)).toBe(false);
  for (const kept of [current, active, liveJob]) expect(existsSync(kept), kept).toBe(true);
});
