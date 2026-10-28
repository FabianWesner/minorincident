#!/usr/bin/env python3
"""Forward cancellation and optional batch timeout to this owned process group."""
import argparse
import os
import signal
import subprocess
import sys
import time

parser = argparse.ArgumentParser()
parser.add_argument('--seconds', type=int, default=0)
parser.add_argument('command', nargs=argparse.REMAINDER)
args = parser.parse_args()
command = args.command[1:] if args.command[:1] == ['--'] else args.command
child = subprocess.Popen(command, start_new_session=True)
if os.environ.get('MI_WAIT_STARTED'):
    subprocess.run(['node', 'tools/qa/log-wait.mjs', os.environ.get('MI_WAIT_KIND', 'browser'), os.environ['MI_WAIT_STARTED']], check=False)


class Cancelled(BaseException):
    def __init__(self, signum):
        self.signum = signum


def stop(signum, _frame):
    raise Cancelled(signum)


def process_tree():
    # Identity guards prevent a recycled PID from becoming a cleanup target.
    result = {}
    try:
        output = subprocess.check_output(['ps', '-axo', 'pid=,ppid=,lstart='], text=True)
    except (OSError, subprocess.CalledProcessError):
        return result  # Process-group cleanup still works without ps access.
    for line in output.splitlines():
        fields = line.split(None, 2)
        if len(fields) == 3:
            result[int(fields[0])] = (int(fields[1]), fields[2])
    return result


def descendants(known, tree):
    owned = {pid: identity for pid, identity in known.items() if pid in tree and tree[pid][1] == identity[1]}
    while True:
        more = {pid: identity for pid, identity in tree.items() if identity[0] in owned}
        if more.keys() <= owned.keys():
            return owned
        owned.update(more)


def terminate():
    for sig in (signal.SIGTERM, signal.SIGINT, signal.SIGHUP):
        signal.signal(sig, signal.SIG_IGN)
    # The command has its own session/process group. Signal the group directly so
    # wrappers such as npx cannot orphan grandchildren by exiting first.
    tree = process_tree()
    owned = descendants({child.pid: tree[child.pid]} if child.pid in tree else {}, tree)
    # Playwright can detach Chrome into a separate process group. Preserve owned
    # descendant cleanup in addition to the npx/Vitest group.
    detached = []
    for pid in owned:
        try:
            if os.getpgid(pid) != child.pid:
                detached.append(pid)
                os.kill(pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
    try:
        os.killpg(child.pid, signal.SIGTERM)
    except ProcessLookupError:
        pass
    deadline = time.monotonic() + 5
    while time.monotonic() < deadline:
        child.poll()
        try:
            os.killpg(child.pid, 0)
        except ProcessLookupError:
            if not detached:
                break
        time.sleep(0.1)
    try:
        os.killpg(child.pid, signal.SIGKILL)
    except ProcessLookupError:
        pass
    for pid in descendants(owned, process_tree()):
        try:
            os.kill(pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
    child.wait()

signal.signal(signal.SIGTERM, stop)
signal.signal(signal.SIGINT, stop)
signal.signal(signal.SIGHUP, stop)
try:
    code = child.wait(timeout=args.seconds or None)
    # Wrappers can exit successfully while leaving a grandchild in their group.
    terminate()
except subprocess.TimeoutExpired:
    print(f'Browser reservation reached its {args.seconds}s batch limit (10-minute maximum including cleanup); split the batch into smaller commands.', file=sys.stderr)
    terminate()
    code = 124
except Cancelled as cancelled:
    terminate()
    code = 128 + cancelled.signum
sys.exit(code if code >= 0 else 128 - code)
