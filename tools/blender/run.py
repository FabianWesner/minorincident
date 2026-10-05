#!/usr/bin/env python3
"""Headless runner, adapted from experiment/tools/blender_run.py.

All lanes share four process slots and one Cycles slot in the system temp dir.
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
    directory = Path(tempfile.gettempdir()) / 'minor-incident-blender-locks'
    directory.mkdir(exist_ok=True)
    while True:
        for index in range(count):
            lock = open(directory / f'{prefix}{index}.lock', 'a')
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
                return lock
            except BlockingIOError:
                lock.close()
        time.sleep(0.2)


def run(script, args):
    held = [acquire('any', 4)]
    try:
        if '--render' in args or '--bake-ao' in args:
            held.append(acquire('cycles', 1))
        binary = os.environ.get('BLENDER_BIN', '/Applications/Blender.app/Contents/MacOS/Blender')
        return subprocess.run([binary, '--background', '--factory-startup', '-t', '3',
                               '--python-exit-code', '1', '--python', str(script), '--', *args]).returncode
    finally:
        for lock in reversed(held):
            fcntl.flock(lock, fcntl.LOCK_UN)
            lock.close()


if __name__ == '__main__':
    sys.exit(run(sys.argv[1], sys.argv[2:]))
