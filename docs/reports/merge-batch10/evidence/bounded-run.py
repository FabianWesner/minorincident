#!/usr/bin/env python3
"""Bound an entire reservation, including preflight, and release all owned children."""
import os
import signal
import subprocess
import sys
limit = int(sys.argv[1])
process = subprocess.Popen(sys.argv[2:], start_new_session=True)
try:
    status = process.wait(timeout=limit - 10)
except subprocess.TimeoutExpired:
    print(f'Reservation deadline: terminating owned process group after {limit - 10}s', flush=True)
    os.killpg(process.pid, signal.SIGTERM)
    try:
        process.wait(timeout=8)
    except subprocess.TimeoutExpired:
        os.killpg(process.pid, signal.SIGKILL)
        process.wait()
    status = 124
sys.exit(status)
