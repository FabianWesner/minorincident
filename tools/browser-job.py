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


class Cancelled(BaseException):
    def __init__(self, signum):
        self.signum = signum


def stop(signum, _frame):
    raise Cancelled(signum)


def process_tree():
    # lstart prevents signalling a PID that has been recycled during cleanup.
    result = {}
    output = subprocess.check_output(['ps', '-axo', 'pid=,ppid=,lstart='], text=True)
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
    tree = process_tree()
    known = {child.pid: tree[child.pid]} if child.pid in tree else {}
    owned = descendants(known, tree)
    # Include detached browser roots: Playwright can give Chrome its own group.
    for pid in owned:
        try:
            os.kill(pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
    time.sleep(5)
    tree = process_tree()
    owned = descendants(owned, tree)
    for pid in owned:
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
except subprocess.TimeoutExpired:
    print('Quiet-run: 20 minute batch limit reached; release slots and report remaining coverage.', file=sys.stderr)
    terminate()
    code = 124
except Cancelled as cancelled:
    terminate()
    code = 128 + cancelled.signum
sys.exit(code if code >= 0 else 128 - code)
