#!/usr/bin/env python3
"""Headless runner, adapted from experiment/tools/blender_run.py.

All lanes share three process slots and one Cycles slot. Existing reference-tool
locks are opened read-only; other checkouts use a common system-temp pool.
Script exceptions are fatal; locks are released even when Blender fails.
"""
import fcntl
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time


def acquire(prefix, count):
    root = Path(__file__).resolve().parents[2]
    common = subprocess.check_output(['git', '-C', str(root), 'rev-parse', '--git-common-dir'], text=True).strip()
    reference = (root / common).resolve().parent / 'experiment/tools/.locks'
    if all((reference / f'any{index}.lock').exists() for index in range(4)) and (reference / 'slot0.lock').exists():
        directory, mode = reference, 'r'
    else:
        directory = Path(tempfile.gettempdir()) / 'minor-incident-blender-locks'
        directory.mkdir(exist_ok=True)
        mode = 'a'
    while True:
        for index in range(count):
            lock = open(directory / f'{prefix}{index}.lock', mode)
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
                return lock
            except BlockingIOError:
                lock.close()
        time.sleep(0.2)


def run(script, args):
    held = [acquire('any', 3)]
    try:
        if '--render' in args or '--bake-ao' in args:
            held.append(acquire('slot', 1))
        binary = os.environ.get('BLENDER_BIN', '/Applications/Blender.app/Contents/MacOS/Blender')
        return subprocess.run([binary, '--background', '--factory-startup', '-t', '3',
                               '--python-exit-code', '1', '--python', str(script), '--', *args]).returncode
    finally:
        for lock in reversed(held):
            fcntl.flock(lock, fcntl.LOCK_UN)
            lock.close()


if __name__ == '__main__':
    sys.exit(run(sys.argv[1], sys.argv[2:]))
