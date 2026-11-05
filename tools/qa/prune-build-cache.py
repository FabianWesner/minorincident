#!/usr/bin/env python3
"""Bound immutable dist storage; cloned worktree outputs remain independent."""
import fcntl
import os
from pathlib import Path
import re
import shutil
import sys

store = Path(sys.argv[1])
current = sys.argv[2]
keep = max(1, int(os.environ.get('MI_BUILD_CACHE_ENTRIES', '3')))
with (store / 'locks' / 'dist-prune').open('a') as pruning:
    try:
        fcntl.flock(pruning, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        sys.exit(0)
    entries = sorted((p for p in (store / 'dist').iterdir()
                      if p.is_dir() and not p.is_symlink() and re.fullmatch(r'[a-f0-9]{64}', p.name)),
                     key=lambda p: p.stat().st_mtime, reverse=True)
    for entry in entries[keep:]:
        if entry.name == current:
            continue
        # Never prune an entry while another build clones or publishes it.
        with (store / 'locks' / ('dist-' + entry.name)).open('a') as lock:
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                continue
            shutil.rmtree(entry, ignore_errors=True)
