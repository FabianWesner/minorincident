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


def terminate():
    for sig in (signal.SIGTERM, signal.SIGINT, signal.SIGHUP):
        signal.signal(sig, signal.SIG_IGN)
    # The command has its own session/process group. Signal the group directly so
    # wrappers such as npx cannot orphan grandchildren by exiting first.
    try:
        os.killpg(child.pid, signal.SIGTERM)
    except ProcessLookupError:
        pass
    deadline = time.monotonic() + 5
    while time.monotonic() < deadline:
        try:
            os.killpg(child.pid, 0)
        except ProcessLookupError:
            break
        time.sleep(0.1)
    try:
        os.killpg(child.pid, signal.SIGKILL)
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
