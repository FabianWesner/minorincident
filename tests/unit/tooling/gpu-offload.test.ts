import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { expect, test } from 'vitest';

// Exercise the real sampler with deterministic process snapshots, without waiting
// ten seconds or depending on the host's current WindowServer/browser load.
function guard(before: Record<string, number>, after: Record<string, number>, browsers: number, units = 1) {
  return execFileSync('python3', ['-c', `
import importlib.util, unittest.mock as mock
spec = importlib.util.spec_from_file_location('guard', 'tools/mac-gpu-guard.py')
g = importlib.util.module_from_spec(spec); spec.loader.exec_module(g)
with mock.patch.object(g.sys, 'platform', 'darwin'), mock.patch.object(g.sys, 'argv', ['guard', '${units}']), mock.patch.object(g.time, 'sleep') as sleep, mock.patch.object(g.time, 'monotonic', side_effect=[0, 10]), mock.patch.object(g, 'snapshot', side_effect=[(${JSON.stringify(before)}, 0), (${JSON.stringify(after)}, ${browsers})]):
    print(g.main())
    sleep.assert_called_once_with(10)
`], { encoding: 'utf8' }).trim();
}
test('WindowServer admission uses the measured ten second CPU delta and a strict 60% threshold', () => {
  expect(guard({ '10': 100 }, { '10': 106 }, 0)).toBe('0');
  expect(guard({ '10': 100 }, { '10': 106.01 }, 0)).toBe('75');
  expect(guard({ '10': 100 }, { '10': 99 }, 0)).toBe('75');
  expect(guard({}, {}, 0)).toBe('75');
  expect(guard({ '10': 100 }, { '11': 100 }, 0)).toBe('75');
});
test('external headless browser roots count toward the hard two-browser ceiling', () => {
  expect(guard({ '10': 100 }, { '10': 100 }, 1)).toBe('0');
  expect(guard({ '10': 100 }, { '10': 100 }, 2)).toBe('75');
  expect(guard({ '10': 100 }, { '10': 100 }, 1, 2)).toBe('75');
});
test('process census counts headless browser roots, excluding GPU subprocesses and quoted scheduler commands', () => {
  const output = execFileSync('python3', ['-c', `
import importlib.util, unittest.mock as mock
spec = importlib.util.spec_from_file_location('guard', 'tools/mac-gpu-guard.py')
g = importlib.util.module_from_spec(spec); spec.loader.exec_module(g)
processes = '''10 12:03.50 /System/Library/PrivateFrameworks/SkyLight.framework/Resources/WindowServer
11 0:01.00 /cache/chrome-headless-shell --no-sandbox
12 0:01.00 /cache/chrome-headless-shell --type=gpu-process
13 0:01.00 /Applications/Google Chrome.app/Contents/MacOS/Google Chrome --headless=new
14 0:01.00 /usr/bin/python scheduler /cache/chrome-headless-shell --headless
15 0:01.00 /cache/chrome --type=renderer --headless
16 0:01.00 /cache/Chromium --headless
17 1-02:03:04.50 /System/Library/PrivateFrameworks/SkyLight.framework/Resources/WindowServer
'''
with mock.patch.object(g.subprocess, 'check_output', return_value=processes):
    assert g.snapshot() == ({'10': 723.5, '17': 93784.5}, 3), g.snapshot()
print('ok')
`], { encoding: 'utf8' });
  expect(output.trim()).toBe('ok');
});
test('uncapped probes fail closed outside quiet-run', async () => {
  const { uncappedArgs } = await import('../../../tools/perf/uncapped');
  const previous = process.env.MI_PERF_LOCK_HELD;
  try {
    delete process.env.MI_PERF_LOCK_HELD;
    expect(uncappedArgs).toThrow('quiet-run');
    process.env.MI_PERF_LOCK_HELD = '1';
    expect(uncappedArgs()).toContain('--disable-frame-rate-limit');
  } finally {
    if (previous === undefined) delete process.env.MI_PERF_LOCK_HELD;
    else process.env.MI_PERF_LOCK_HELD = previous;
  }
});
test('quiet-run bounds its owned batch and remote browser setup only marks success after install', () => {
  const quiet = readFileSync('tools/perf/quiet-run.sh', 'utf8');
  expect(quiet).toContain('--seconds 1195');
  expect(quiet).toContain('E2E_ADMISSION_TIMEOUT_SECONDS:-1800');
  expect(quiet).toContain('+ MI_PERF_ADMISSION_TIMEOUT_SECONDS');
  const setup = readFileSync('tools/remote/browser-setup.sh', 'utf8');
  expect(setup.indexOf('touch "$marker"')).toBeGreaterThan(setup.indexOf('install chromium'));
  expect(setup).toContain('set -euo pipefail');
});

test('owned browser batches enforce their timeout and preserve the child exit code', () => {
  expect(execFileSync('python3', ['tools/browser-job.py', '--', 'python3', '-c', 'print("owned")'], { encoding: 'utf8' }).trim()).toBe('owned');
  const result = spawnSync('python3', ['tools/browser-job.py', '--seconds', '1', '--', 'python3', '-c', 'import subprocess,sys,time; p=subprocess.Popen([sys.executable,"-c","import signal,time; signal.signal(signal.SIGTERM,signal.SIG_IGN); time.sleep(60)"],start_new_session=True); print(p.pid,flush=True); time.sleep(60)'], { timeout: 8000, encoding: 'utf8' });
  expect(result.status).toBe(124);
  const pid = result.stdout.trim();
  expect(pid).toMatch(/^\d+$/);
  const remaining = spawnSync('ps', ['-o', 'stat=', '-p', pid], { encoding: 'utf8' });
  expect(remaining.status === 1 || remaining.stdout.trim().startsWith('Z')).toBe(true);
});


test('catalog routing honors the last backend and copies the requested result directory', () => {
  const dir = mkdtempSync(`${tmpdir()}/mi-offload-routing-`);
  try {
    writeFileSync(`${dir}/sh`, '#!/bin/sh\nprintf "<%s>\\n" "$@"\n', { mode: 0o755 });
    const route = (...args: string[]) => execFileSync('/bin/sh', ['tools/remote/scene.sh', ...args], { env: { ...process.env, MI_REMOTE: '', PATH: `${dir}:${process.env.PATH}` }, encoding: 'utf8' });
    const remote = route('--matrix', '--backend', 'webgpu', '--backend', 'webgl2', '--out', 'test-results/proof');
    expect(remote).toContain('<tools/remote/run.sh>');
    expect(remote).toContain('<--pull>\n<test-results/proof>');
    expect(remote).toContain('<SCENE_SERVER=preview>');
    expect(route('--backend', 'webgpu')).toContain('<tools/e2e-lock.sh>');
    expect(() => route('--out', '../outside')).toThrow();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});


test('browser scripts default to local admission and expose remote runs only by opt-in', () => {
  const { scripts } = JSON.parse(readFileSync('package.json', 'utf8'));
  expect(scripts['test:e2e']).toBe('sh tools/e2e-lock.sh playwright test --project=chromium');
  expect(scripts['scene:catalog']).toBe('sh tools/e2e-lock.sh tsx tools/scenelab/catalog.ts');
  expect(scripts['scene:matrix']).toContain('E2E_UNITS=2 sh tools/e2e-lock.sh');
  expect(scripts['scene:matrix']).toContain('--backend webgpu');
  expect(scripts['scene:matrix']).not.toContain('gpu-offload-*');
  expect(scripts['scene:matrix:remote']).toBe(scripts['scene:matrix']
    .replace('E2E_UNITS=2 sh tools/e2e-lock.sh tsx tools/scenelab/catalog.ts', 'sh tools/remote/scene.sh')
    .replace('--backend webgpu', '--backend webgl2'));
  expect(scripts['test:e2e:remote']).toBe('sh tools/remote/e2e.sh');
});
