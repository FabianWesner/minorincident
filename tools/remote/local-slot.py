#!/usr/bin/env python3
"""Machine-wide FIFO dispatch and one yielding, CPU-only Mac slot. Stdlib only."""
import contextlib
import datetime
import fcntl
import json
import os
from pathlib import Path
import re
import shlex
import signal
import subprocess
import sys
import time
import urllib.error
import urllib.request

HERE = Path(__file__).resolve().parent
ROOT = Path(os.environ.get('MI_LOCAL_QUEUE', Path(os.environ.get('TMPDIR', '/tmp')) / 'minor-incident-remote-queue'))
QUEUE = ROOT / 'tickets'
LOCAL = ROOT / 'local.lock'
BASE_LOCK = os.environ.get('E2E_LOCK', '/tmp/minor-incident-e2e.lock')


@contextlib.contextmanager
def mutex():
    ROOT.mkdir(parents=True, exist_ok=True)
    with (ROOT / 'dispatch.lock').open('a+') as f:
        fcntl.flock(f, fcntl.LOCK_EX)
        yield


def slot_lock():
    ROOT.mkdir(parents=True, exist_ok=True)
    f = LOCAL.open('a+')
    try:
        fcntl.flock(f, fcntl.LOCK_EX | fcntl.LOCK_NB)
        return f
    except BlockingIOError:
        f.close()
        return None


def processes():
    return subprocess.check_output(['ps', '-axo', 'command='], text=True).splitlines()


def shared_browser_helper():
    shared = HERE.parent / 'browser-busy.sh'
    if not shared.exists():
        # A lane can consume lane-infra's merged helper without copying it into
        # an older worktree or changing the files owned by that lane.
        common = subprocess.run(['git', '-C', str(HERE), 'rev-parse', '--path-format=absolute', '--git-common-dir'], capture_output=True, text=True)
        merged = subprocess.run(['git', '-C', str(HERE), 'cat-file', '-e', 'main:tools/browser-busy.sh'], stderr=subprocess.DEVNULL)
        if common.returncode == 0 and merged.returncode == 0:
            shared = Path(common.stdout.strip()).parent / 'tools/browser-busy.sh'
    return shared if shared.exists() else None


def browser_busy():
    # lane-infra owns this contract: 0 = active reservation, 1 = clear.
    shared = shared_browser_helper()
    if shared:
        if subprocess.run(['sh', str(shared)], stdout=subprocess.DEVNULL).returncode != 1:
            return True
    else:
        # lockf files survive release; only the actual advisory lock is meaningful.
        for i in range(4):
            with open(f'{BASE_LOCK}.{i}', 'a+') as f:
                try:
                    fcntl.lockf(f, fcntl.LOCK_EX | fcntl.LOCK_NB)
                    fcntl.lockf(f, fcntl.LOCK_UN)
                except BlockingIOError:
                    return True
    try:
        url = os.environ.get('BROWSER_POOL_URL', 'http://127.0.0.1:4329')
        with urllib.request.urlopen(url + '/health', timeout=.3) as response:
            health = json.load(response)
        if health.get('exclusive') or any(b.get('backend') == 'gpu' for b in health.get('browsers', [])):
            return True
    except (OSError, ValueError, urllib.error.URLError):
        pass  # Pool down: the legacy locks and process check remain authoritative.
    for command in processes():
        # Anchor executable paths; scheduler summaries quoting Chrome aren't browsers.
        chrome = re.match(r'^/(?:[^ \t]+/(?:chrome|Chromium|chrome-headless-shell|headless_shell)|Applications/Google Chrome[.]app/Contents/MacOS/Google Chrome|[^ \t]+/Google Chrome for Testing[.]app/Contents/MacOS/Google Chrome for Testing)(?:\s|$)', command)
        helper_gpu = re.match(r'^/(?:Applications/Google Chrome[.]app/|[^ \t]+/Google Chrome for Testing[.]app/).*Helper \(GPU\)(?:\s|$)', command)
        if (chrome or helper_gpu) and ('--type=gpu-process' in command or '--type=' not in command):
            if '--use-angle=swiftshader' not in command:
                return True
    return False


def quiet_busy():
    return any(re.match(r'^(?:\S*/)?(?:sh|bash)\s+(?:\S*/)?tools/perf/quiet-run\.sh(?:\s|$)', c)
               or re.match(r'^(?:\S*/)?node\s+.*tools/browser-pool/wrapper\.ts\s+exclusive(?:\s|$)', c)
               for c in processes())


def file_admitted():
    try:
        if browser_busy(): return False, 'GPU/browser reservation active'
        if quiet_busy(): return False, 'quiet-run active or waiting'
    except (OSError, subprocess.SubprocessError):
        return False, 'browser/quiet process sample unavailable'
    return True, 'GPU/browser and quiet-run clear'


def free_gb():
    if sys.platform == 'darwin':
        vm = subprocess.check_output(['vm_stat'], text=True)
        page = int(re.search(r'page size of (\d+) bytes', vm)[1])
        # Require genuinely free physical pages; don't count inactive caches,
        # compressed memory, or purgeable pages twice.
        return int(re.search(r'Pages free:\s+(\d+)', vm)[1]) * page / 1024**3
    with open('/proc/meminfo') as f:
        return int(re.search(r'MemAvailable:\s+(\d+)', f.read())[1]) / 1024**2


def admitted():
    ok, why = file_admitted()
    if not ok: return ok, why
    try:
        load, ram = os.getloadavg()[0], free_gb()
    except (OSError, subprocess.SubprocessError, TypeError):
        return False, 'load/RAM sample unavailable'
    if load >= 6: return False, f'load {load:.2f} >= 6'
    if ram < 4: return False, f'free RAM {ram:.2f} GiB < 4 GiB'
    return True, f'load {load:.2f}, free RAM {ram:.2f} GiB'


def cpu_command(wt, command, named=False):
    """Expand only known plain Vitest scripts; never execute a shell on the Mac."""
    args = list(command)
    if args[:2] == ['npm', 'run'] and len(args) >= 3:
        name = args[2]
        if name not in ('test:unit', 'test:sim', 'test:gate', 'test:nightly'): return None
        script = json.loads((Path(wt) / 'package.json').read_text()).get('scripts', {}).get(name, '')
        tail = args[3:]
        if tail[:1] == ['--']: tail = tail[1:]
        expanded = shlex.split(script)
        if any(c in script for c in ('&&', '||', ';', '|', '$', '`', '\n')): return None
        return cpu_command(wt, expanded + tail, named=True)
    receipt_lane = None
    if args[:2] == ['node', 'tools/test-lane.mjs']:
        if len(args) < 4 or not re.fullmatch(r'[A-Za-z0-9_-]+', args[2]): return None
        receipt_lane = args[2]
        args = args[3:]
    if args[:2] == ['npx', 'vitest']: args = args[1:]
    if not args or Path(args[0]).name != 'vitest' or args[1:2] != ['run']: return None
    args = args[1:]
    values = {'-t', '--testNamePattern', '--reporter', '--outputFile', '--maxWorkers', '--minWorkers', '--configLoader', '--project', '--exclude', '--testTimeout', '--hookTimeout', '--bail', '--retry', '--shard', '--sequence.seed'}
    filters, skip = [], False
    for arg in args[1:]:
        if skip: skip = False; continue
        key = arg.split('=', 1)[0]
        if key.startswith(('--browser.', '--api.', '--ui.')): return None
        if key in ('--watch', '-w', '--browser', '--ui', '--api', '--config', '-c', '--root', '--pool', '--runner', '--update', '-u'): return None
        if key in values and '=' not in arg: skip = True; continue
        if not arg.startswith('-'): filters.append(arg)
    if not filters and not named: return None
    roots = r'^tests/(unit|sim|levels|qa/invariants)(?:/|$)' if named else r'^tests/(unit|sim|levels)(?:/|$)'
    if any(not re.match(roots, p) or '..' in Path(p).parts for p in filters): return None
    return args, receipt_lane


def enqueue(owner, wt):
    with mutex():
        QUEUE.mkdir(exist_ok=True)
        stamp = time.time_ns()
        # Atomic creation under the dispatch mutex defines the arrival order.
        ticket = QUEUE / f'{stamp:020d}-{owner}.json'
        ticket.write_text(json.dumps({'pid': owner, 'queuedNs': stamp,
                                      'lane': os.environ.get('MI_LANE', Path(wt).name), 'worktree': wt}))
        return ticket


def live_tickets():
    for path in sorted(QUEUE.glob('*.json')):
        try:
            data = json.loads(path.read_text())
            os.kill(data['pid'], 0)
            yield path, data
        except (ProcessLookupError, ValueError, FileNotFoundError): path.unlink(missing_ok=True)
        except PermissionError: yield path, data


def first(ticket):
    with mutex():
        return next(iter(live_tickets()), (None, None))[0] == ticket


def record_wait(ticket, kind):
    data = json.loads(ticket.read_text())
    receipt = {'lane': data['lane'], 'lock': kind,
               'waitMs': max(0, (time.time_ns() - data['queuedNs']) // 1_000_000),
               'ts': datetime.datetime.now(datetime.timezone.utc).isoformat()}
    path = Path(os.environ.get('TMPDIR', '/tmp')) / 'mi-waits.jsonl'
    with path.open('a') as f:
        fcntl.flock(f, fcntl.LOCK_EX)
        f.write(json.dumps(receipt) + '\n')


def remote_pick():
    result = subprocess.run([sys.executable, '-I', str(HERE / 'pool.py'), 'try'], capture_output=True, text=True)
    return result.stdout.strip() if result.returncode == 0 else ''


def choose(ticket, wt, command):
    if not first(ticket): return None
    remote = remote_pick()
    if remote: return remote
    if os.environ.get('MI_LOCAL_FALLBACK', '1') == '0' or sys.platform != 'darwin': return None
    if cpu_command(wt, command) is None or not admitted()[0]: return None
    f = slot_lock()
    if f is None: return None
    f.close()
    return 'local'


def run_local(ticket, wt, command):
    parsed = cpu_command(wt, command)
    if parsed is None: return 64
    args, receipt_lane = parsed
    f = slot_lock()
    if f is None: return 75
    with f:
        ok, why = admitted()
        if not ok: return 75
        env = dict(os.environ, CI='1', MI_LOCAL_RUNNER='1')
        for entry in os.environ.get('MI_LOCAL_ENVS', '').splitlines():
            if entry:
                key, value = entry.split('=', 1)
                if not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]*', key): return 64
                env[key] = value
        env['MI_LOCAL_HOST_LOCK'] = BASE_LOCK
        env['MI_LOCAL_STATE'] = str(ROOT / 'local.json')
        env['MI_LOCAL_LANE'] = json.loads(ticket.read_text())['lane']
        # Admission is recorded before the ticket is released, exactly once.
        record_wait(ticket, 'local')
        ticket.unlink(missing_ok=True)
        print(f'[local] admitted ({why}); Vitest <=4 workers; worktree {wt}', flush=True)
        argv = ['node', str(HERE / 'cpu-run.mjs'), *args]
        if receipt_lane:
            argv = ['node', 'tools/test-lane.mjs', receipt_lane, *argv]
        child = subprocess.Popen(argv, cwd=wt, env=env, start_new_session=True)
        def stop(signum, _frame):
            os.killpg(child.pid, signal.SIGTERM)
            try: child.wait(timeout=10)
            except subprocess.TimeoutExpired:
                os.killpg(child.pid, signal.SIGKILL); child.wait()
            raise SystemExit(128 + signum)
        previous = {sig: signal.signal(sig, stop) for sig in (signal.SIGINT, signal.SIGTERM, signal.SIGHUP)}
        try:
            rc = child.wait()
            return rc if rc >= 0 else 128 - rc
        finally:
            for sig, handler in previous.items(): signal.signal(sig, handler)
            (ROOT / 'local.json').unlink(missing_ok=True)


def main():
    cmd = sys.argv[1]
    if cmd in ('admit', 'file-admit'):
        ok, why = admitted() if cmd == 'admit' else file_admitted()
        print(why); return 0 if ok else 1
    if cmd == 'enqueue': print(enqueue(int(sys.argv[2]), sys.argv[3])); return 0
    if cmd == 'remove': Path(sys.argv[2]).unlink(missing_ok=True); return 0
    if cmd == 'first': return 0 if first(Path(sys.argv[2])) else 1
    if cmd == 'record': record_wait(Path(sys.argv[2]), sys.argv[3]); return 0
    if cmd == 'choose':
        selected = choose(Path(sys.argv[2]), sys.argv[3], sys.argv[5:])
        if selected: print(selected); return 0
        return 75
    if cmd == 'run': return run_local(Path(sys.argv[2]), sys.argv[3], sys.argv[5:])
    if cmd == 'status':
        with mutex():
            for path, data in live_tickets():
                print(f"FIFO {data['lane']} pid={data['pid']} waiting={(time.time_ns()-data['queuedNs'])//1_000_000}ms worktree={data['worktree']}")
        f = slot_lock()
        if f: f.close(); print('local slot: free')
        else:
            try:
                state = json.loads((ROOT / 'local.json').read_text())
                print(f"local slot: {state['phase']} lane={state['lane']} pid={state['pid']} active files={state['files']}")
            except (OSError, ValueError, KeyError): print('local slot: busy (starting)')
        ok, why = admitted()
        print(f'local admission: {"eligible" if ok else "waiting"} ({why})')
        return 0
    raise SystemExit('usage: local-slot.py admit|file-admit|enqueue|choose|run|record|remove|first|status')

if __name__ == '__main__': sys.exit(main())
