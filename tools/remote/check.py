#!/usr/bin/env python3
"""Focused scheduler checks; fixtures are disposable, never repository test files.
python3 tools/remote/check.py --unit  # no Vitest work on a busy Mac
python3 tools/remote/check.py         # includes real worker drain/resume + fallback
"""
import fcntl
import importlib.util
import json
import io
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('slot', HERE / 'local-slot.py')
slot = importlib.util.module_from_spec(spec)
spec.loader.exec_module(slot)
bench_spec = importlib.util.spec_from_file_location('benchmark', HERE / 'benchmark.py')
benchmark = importlib.util.module_from_spec(bench_spec)
bench_spec.loader.exec_module(benchmark)
UNIT_ONLY = '--unit' in sys.argv


class SchedulerChecks(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='mi-slot-check-')
        self.root = Path(self.tmp.name)
        self.patches = [patch.object(slot, 'ROOT', self.root / 'queue'),
                        patch.object(slot, 'QUEUE', self.root / 'queue/tickets'),
                        patch.object(slot, 'LOCAL', self.root / 'queue/local.lock'),
                        patch.object(slot, 'BASE_LOCK', str(self.root / 'gpu')),
                        patch.object(slot, 'shared_browser_helper', return_value=None),
                        patch.object(slot.urllib.request, 'urlopen', side_effect=OSError('pool down')),
                        patch.dict(os.environ, {'TMPDIR': str(self.root), 'MI_LANE': 'fixture'})]
        for p in self.patches: p.start()
        self.wt = self.root / 'worktree'; self.wt.mkdir()
        (self.wt / 'package.json').write_text(json.dumps({'type': 'module', 'scripts': {
            'test:gate': "vitest run tests/unit tests/sim tests/levels tests/qa/invariants --testNamePattern='^(?!.*@nightly)'",
            'test:nightly': 'vitest run tests/unit --testNamePattern=@nightly',
            'test:unit': 'node tools/test-lane.mjs unit vitest run tests/unit',
            'test:sim': 'sh -c "vitest run tests/sim && playwright test"'}}))

    def tearDown(self):
        for p in reversed(self.patches): p.stop()
        self.tmp.cleanup()

    def ticket(self): return slot.enqueue(os.getpid(), str(self.wt))

    def test_adapter_uses_worktree_vitest_installation(self):
        # A tiny fake API proves resolution without starting any CPU workers.
        package = self.wt / 'node_modules/vitest'; package.mkdir(parents=True)
        (package / 'package.json').write_text(json.dumps({'type': 'module', 'exports': {'./node': './node.mjs'}}))
        (package / 'node.mjs').write_text('''
import {writeFileSync} from 'node:fs';
export class ThreadsPoolWorker {}
export const parseCLI = () => ({filter: [], options: {}});
export async function createVitest(options) {
 const project = {config: {}};
 return {projects: [project], getRootProject: () => project,
  start: async () => writeFileSync('worktree-api.json', JSON.stringify({maxWorkers: options.maxWorkers, pool: project.config.pool})),
  close: async () => {}, state: {getCountOfFailedTests: () => 0, getUnhandledErrors: () => []}};
}
''')
        env = dict(os.environ); env.pop('MI_LOCAL_STATE', None)
        run = subprocess.run(['node', str(HERE / 'cpu-run.mjs'), 'run', 'tests/unit'], cwd=self.wt,
                             env=env, capture_output=True, text=True, timeout=10)
        self.assertEqual(run.returncode, 0, run.stdout + run.stderr)
        self.assertEqual(json.loads((self.wt / 'worktree-api.json').read_text()), {'maxWorkers': 4, 'pool': 'mi-local-cpu'})

    def test_benchmark_requires_actual_receipt_overlap(self):
        jobs = [{'backend': backend, 'executionFilesMs': [[start, end]]} for backend, start, end in
                [('remote', 1000, 4000), ('remote', 2000, 5000), ('remote', 2500, 6000), ('local', 3000, 7000)]]
        self.assertEqual(benchmark.receipt_overlap(jobs), 1)
        jobs[3]['executionFilesMs'] = [[4100, 7000]]
        self.assertEqual(benchmark.receipt_overlap(jobs), 0)
        jobs[3]['executionFilesMs'] = [[1000, 2400], [4100, 7000]]
        self.assertEqual(benchmark.receipt_overlap(jobs), 0)  # Yielded during remote overlap.
        del jobs[3]['executionFilesMs']
        self.assertEqual(benchmark.receipt_overlap(jobs), 0)
        jobs[3]['backend'] = 'remote'
        self.assertEqual(benchmark.receipt_overlap(jobs), 0)

    def test_fifo_death_cleanup_and_receipt(self):
        a, b = self.ticket(), self.ticket()
        self.assertTrue(slot.first(a)); self.assertFalse(slot.first(b))
        data = json.loads(a.read_text()); data['pid'] = 99999999; a.write_text(json.dumps(data))
        self.assertTrue(slot.first(b)); self.assertFalse(a.exists())
        slot.record_wait(b, 'remote')
        row = json.loads((self.root / 'mi-waits.jsonl').read_text())
        self.assertEqual((row['lane'], row['lock']), ('fixture', 'remote'))
        self.assertGreaterEqual(row['waitMs'], 0); self.assertIn('ts', row)

    def test_pool_probe_counts_reserved_queue_capacity(self):
        module = importlib.util.spec_from_file_location('pool_check', HERE / 'pool.py')
        pool = importlib.util.module_from_spec(module); module.loader.exec_module(pool)
        with patch.object(pool, 'rsh', return_value=(0, '1 0 123 1.5 2 cache,')):
            self.assertEqual(pool.state({'name': 'fixture', 'public_net': {'ipv4': {'ip': '192.0.2.1'}}})['occupied'], 2)
        with patch.object(pool, 'servers', return_value=[{'status': 'running'}]), patch.object(pool, 'SLOTS', 2), patch.object(pool, 'states', return_value=[{'running': 1, 'waiting': 1, 'last': 1, 'load': 0, 'ip': '192.0.2.1'}]):
            self.assertEqual(pool.pick_now(), 3)
            with patch.object(pool, 'states', return_value=[{'running': 1, 'occupied': 2, 'waiting': 0, 'last': 1, 'load': 0, 'ip': '192.0.2.1'}]):
                self.assertEqual(pool.pick_now(), 3)  # One timing job holds both locks.
            with patch.object(pool, 'states', return_value=[{'running': 1, 'waiting': 0, 'last': 1, 'load': 0, 'ip': '192.0.2.1'}]), patch('sys.stdout', new_callable=io.StringIO) as output:
                self.assertEqual(pool.pick_now(), 0); self.assertEqual(output.getvalue().strip(), '192.0.2.1')
            with patch.object(pool, 'states', side_effect=OSError('unreachable')), patch('sys.stderr', new_callable=io.StringIO):
                self.assertEqual(pool.pick_now(), 4)

    def test_allowlist_and_gate_definitions(self):
        self.assertIsNotNone(slot.cpu_command(self.wt, ['npm', 'run', 'test:gate']))
        self.assertIsNotNone(slot.cpu_command(self.wt, ['npm', 'run', 'test:nightly']))
        self.assertIsNotNone(slot.cpu_command(self.wt, ['npm', 'run', 'test:unit']))
        self.assertEqual(slot.cpu_command(self.wt, ['bash', 'tools/remote/timing-isolated.sh', '--whole-run', 'npm', 'run', 'test:gate']),
                         slot.cpu_command(self.wt, ['npm', 'run', 'test:gate']))
        for cmd in (['npm', 'run', 'test:sim'], ['npx', 'vitest', 'run', 'tests/unit', 'tests/e2e'],
                    ['npx', 'vitest', 'run', 'tests/unit/../../e2e'], ['sh', '-c', 'vitest run tests/unit'],
                    ['npx', 'vitest', 'run', 'tests/unit', '--browser']):
            self.assertIsNone(slot.cpu_command(self.wt, cmd), cmd)

    def test_shared_browser_contract(self):
        for rc, busy in ((0, True), (1, False), (2, True)):
            with patch.object(slot, 'shared_browser_helper', return_value=Path('/shared/browser-busy.sh')), patch.object(slot.subprocess, 'run', return_value=subprocess.CompletedProcess([], rc)) as run, patch.object(slot, 'processes', return_value=[]):
                self.assertEqual(slot.browser_busy(), busy)
                self.assertEqual(run.call_args.args[0], ['sh', '/shared/browser-busy.sh'])

    def test_chrome_and_quiet_processes(self):
        chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome --headless --use-angle=metal'
        gpu = '/Applications/Google Chrome.app/Contents/Frameworks/Google Chrome Framework.framework/Helpers/Google Chrome Helper (GPU).app/Contents/MacOS/Google Chrome Helper (GPU) --type=gpu-process'
        for command in (chrome, gpu, '/Users/a/chrome-headless-shell --headless', '/Users/a/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing --headless'):
            with patch.object(slot, 'processes', return_value=[command]): self.assertTrue(slot.browser_busy(), command)
        with patch.object(slot, 'processes', return_value=['python3 scheduler.py "' + chrome + '"']):
            self.assertFalse(slot.browser_busy())
        with patch.object(slot, 'processes', return_value=['sh tools/perf/quiet-run.sh true']):
            self.assertFalse(slot.file_admitted()[0])
        with patch.object(slot, 'processes', return_value=['node --import tsx tools/browser-pool/wrapper.ts exclusive true']):
            self.assertFalse(slot.file_admitted()[0])

    def test_command_exit_75_is_not_an_admission_retry(self):
        ticket = self.ticket()
        with patch.object(slot, 'admitted', return_value=(True, 'fixture')), patch.object(slot.subprocess, 'Popen') as popen:
            popen.return_value.wait.return_value = 75
            self.assertEqual(slot.run_local(ticket, str(self.wt), ['npm', 'run', 'test:unit']), 75)
        self.assertFalse(ticket.exists())

    def test_free_ram_excludes_reclaimable_and_compressed_pages(self):
        sample = "Mach Virtual Memory Statistics: (page size of 16384 bytes)\nPages free: 262144.\nPages inactive: 999999.\nPages purgeable: 999999.\n"
        with patch.object(slot.sys, 'platform', 'darwin'), patch.object(slot.subprocess, 'check_output', return_value=sample):
            self.assertEqual(slot.free_gb(), 4)

    def test_limits_and_sample_failure(self):
        with patch.object(slot, 'file_admitted', return_value=(True, 'clear')), patch.object(slot.os, 'getloadavg', return_value=(5.99, 0, 0)), patch.object(slot, 'free_gb', return_value=4):
            self.assertTrue(slot.admitted()[0])
            with patch.object(slot.os, 'getloadavg', return_value=(6, 0, 0)): self.assertFalse(slot.admitted()[0])
            with patch.object(slot, 'free_gb', return_value=3.99): self.assertFalse(slot.admitted()[0])
        with patch.object(slot, 'processes', side_effect=OSError('unavailable')):
            self.assertFalse(slot.file_admitted()[0])

    def test_full_pool_selects_local_but_not_with_gpu_or_busy_slot(self):
        ticket = self.ticket()
        with patch.object(slot.sys, 'platform', 'darwin'), patch.object(slot, 'remote_pick', return_value=''), patch.object(slot, 'processes', return_value=[]), patch.object(slot.os, 'getloadavg', return_value=(1, 1, 1)), patch.object(slot, 'free_gb', return_value=8):
            self.assertEqual(slot.choose(ticket, self.wt, ['npm', 'run', 'test:gate']), 'local')
            lock = subprocess.Popen([sys.executable, '-c', 'import fcntl,sys,time; f=open(sys.argv[1],"a+"); fcntl.flock(f,fcntl.LOCK_EX); print("held",flush=True); time.sleep(60)', str(self.root / 'gpu.0')], stdout=subprocess.PIPE, text=True)
            try:
                self.assertEqual(lock.stdout.readline().strip(), 'held')
                self.assertIsNone(slot.choose(ticket, self.wt, ['npm', 'run', 'test:gate']))
            finally: lock.terminate(); lock.wait(); lock.stdout.close()
            f = slot.slot_lock()
            try: self.assertIsNone(slot.choose(ticket, self.wt, ['npm', 'run', 'test:gate']))
            finally: f.close()
            with patch.object(slot, 'remote_pick', return_value='192.0.2.1'):
                self.assertEqual(slot.choose(ticket, self.wt, ['npm', 'run', 'test:gate']), '192.0.2.1')

    @unittest.skipUnless(sys.platform == 'darwin', 'macOS lockf(1) contract')
    def test_actual_macos_browser_lock(self):
        child = subprocess.Popen(['lockf', '-s', '-k', '-t', '0', str(self.root / 'gpu.0'),
                                  sys.executable, '-c', 'import sys; print("held",flush=True); sys.stdin.read()'],
                                 stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True)
        try:
            self.assertEqual(child.stdout.readline().strip(), 'held')
            with patch.object(slot, 'processes', return_value=[]):
                self.assertTrue(slot.browser_busy())
            child.stdin.close()
            self.assertEqual(child.wait(timeout=5), 0)
            with patch.object(slot, 'processes', return_value=[]):
                self.assertFalse(slot.browser_busy())
        finally:
            if child.poll() is None: child.terminate(); child.wait(timeout=5)
            if not child.stdin.closed: child.stdin.close()
            child.stdout.close()

    def fixture(self, count=3, fail=False, sequential=False):
        (self.wt / 'node_modules').symlink_to(HERE.parent.parent / 'node_modules', target_is_directory=True)
        (self.wt / 'vitest.config.mjs').write_text('export default ' + json.dumps({'test': {'pool': 'threads', 'maxWorkers': 1, 'projects': [{'extends': True, 'test': {'name': 'functional', 'isolate': False, 'fileParallelism': not sequential, 'include': ['tests/unit/*.test.js']}}]}}))
        tools = self.wt / 'tools'; tools.mkdir()
        (tools / 'test-lane.mjs').write_bytes((HERE.parent / 'test-lane.mjs').read_bytes())
        target = self.wt / 'tests/unit'; target.mkdir(parents=True)
        events = self.wt / 'events.jsonl'
        for i in range(count):
            (target / f'{i}.test.js').write_text('import {test,expect} from "vitest"; import {appendFileSync} from "node:fs"; test("fixture",async()=>{ const log=phase=>appendFileSync("events.jsonl",JSON.stringify({phase,id:' + str(i) + ',at:Date.now()})+"\\n"); log("start"); await new Promise(r=>setTimeout(r,700)); log("end"); expect(process.env.FIXTURE_ENV).toBe("yes"); expect(' + ('1' if fail else '0') + ').toBe(0);});')
        return events

    @unittest.skipIf(UNIT_ONLY, 'worker checks run in an admitted CPU slot')
    def test_real_fallback_cwd_env_results_exit_and_wait(self):
        self.fixture(count=1)
        ticket = self.ticket()
        with patch.object(slot, 'admitted', return_value=(True, 'fixture admission')), patch.dict(os.environ, {'E2E_LOCK': str(self.root / 'gpu'), 'MI_LOCAL_ENVS': 'FIXTURE_ENV=yes'}):
            self.assertEqual(slot.run_local(ticket, str(self.wt), ['npm', 'run', 'test:unit']), 0)
        self.assertFalse(ticket.exists()); self.assertTrue((self.wt / 'events.jsonl').exists())
        self.assertEqual(json.loads((self.wt / 'test-results/timings/unit.json').read_text())['exitCode'], 0)
        self.assertEqual(json.loads((self.root / 'mi-waits.jsonl').read_text())['lock'], 'local')

    @unittest.skipIf(UNIT_ONLY, 'worker checks run in an admitted CPU slot')
    def test_workers_yield_after_file_and_resume_without_duplicates(self):
        events = self.fixture(count=3, sequential=True)
        env = dict(os.environ, E2E_LOCK=str(self.root / 'gpu'), FIXTURE_ENV='yes')
        log = (self.root / 'worker.log').open('w+')
        child = subprocess.Popen(['node', str(HERE / 'cpu-run.mjs'), 'run', 'tests/unit', '--maxWorkers=1'], cwd=self.wt, env=env, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
        gpu = (self.root / 'gpu.0').open('a+')
        def rows(): return [json.loads(s) for s in events.read_text().splitlines()] if events.exists() else []
        def until(fn, seconds=30):
            end = time.monotonic() + seconds
            while not fn():
                if child.poll() is not None: self.fail(f'worker exited {child.returncode}: {(self.root / "worker.log").read_text()}')
                if time.monotonic() > end: self.fail('worker deadline: ' + (self.root / 'worker.log').read_text())
                time.sleep(.05)
        try:
            until(lambda: len(rows()) >= 1)
            fcntl.flock(gpu, fcntl.LOCK_EX)
            until(lambda: any(r['phase'] == 'end' for r in rows()))
            time.sleep(1)
            self.assertEqual([r['phase'] for r in rows()], ['start', 'end'])
            command = subprocess.check_output(['ps', '-p', str(child.pid), '-o', 'command='], text=True)
            self.assertIn('mi-local-cpu-yielded', command)
            fcntl.flock(gpu, fcntl.LOCK_UN)
            self.assertEqual(child.wait(timeout=30), 0, (self.root / 'worker.log').read_text())
            self.assertEqual(len(rows()), 6)
            self.assertEqual(len({r['id'] for r in rows() if r['phase'] == 'end'}), 3)
            self.assertIn('[local] yielding', (self.root / 'worker.log').read_text())
        finally:
            gpu.close()
            if child.poll() is None: os.killpg(child.pid, signal.SIGTERM); child.wait(timeout=10)
            log.close()

    @unittest.skipIf(UNIT_ONLY, 'worker checks run in an admitted CPU slot')
    def test_worker_cap_and_nonzero_exit(self):
        events = self.fixture(count=8)
        env = dict(os.environ, E2E_LOCK=str(self.root / 'gpu'), FIXTURE_ENV='yes')
        child = subprocess.run(['node', str(HERE / 'cpu-run.mjs'), 'run', 'tests/unit', '--maxWorkers=12'], cwd=self.wt, env=env, capture_output=True, text=True, timeout=60)
        self.assertEqual(child.returncode, 0, child.stdout + child.stderr)
        active, maximum = 0, 0
        for row in [json.loads(s) for s in events.read_text().splitlines()]:
            active += 1 if row['phase'] == 'start' else -1
            maximum = max(maximum, active)
        self.assertGreater(maximum, 1)
        self.assertLessEqual(maximum, 4)
        # A normal assertion failure is still a failing command through the adapter.
        file = self.wt / 'tests/unit/0.test.js'
        file.write_text(file.read_text().replace('expect(0).toBe(0)', 'expect(1).toBe(0)'))
        child = subprocess.run(['node', str(HERE / 'cpu-run.mjs'), 'run', 'tests/unit/0.test.js'], cwd=self.wt, env=env, capture_output=True, text=True, timeout=60)
        self.assertEqual(child.returncode, 1, child.stdout + child.stderr)


if __name__ == '__main__': unittest.main(argv=[sys.argv[0]], verbosity=2)
