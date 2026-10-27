#!/usr/bin/env python3
"""A process-owned cache lock: crashes release it without stale directory locks."""
import fcntl
import os
import subprocess
import sys

path, *command = sys.argv[1:]
if command[:1] == ['--']:
    command = command[1:]
with open(path, 'a') as lock:
    fcntl.flock(lock, fcntl.LOCK_EX)
    sys.exit(subprocess.call(command, env={**os.environ, 'MI_CACHE_LOCK_HELD': path}))
