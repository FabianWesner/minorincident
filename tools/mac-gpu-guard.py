#!/usr/bin/env python3
"""Sample actual WindowServer CPU time over ten seconds; never signal host processes."""
import re
import subprocess
import sys
import time


def snapshot():
    output = subprocess.check_output(['ps', '-axo', 'pid=,time=,command='], text=True)
    servers, browsers = {}, 0
    for line in output.splitlines():
        fields = line.strip().split(None, 2)
        if len(fields) != 3:
            continue
        pid, cpu, command = fields
        if command.endswith('/WindowServer') or '/WindowServer ' in command:
            days, clock = cpu.split('-', 1) if '-' in cpu else ('0', cpu)
            seconds = 0.0
            for part in clock.split(':'):
                seconds = seconds * 60 + float(part)
            servers[pid] = int(days) * 86400 + seconds
        # Browser roots only: renderer/GPU/utility processes carry --type=.
        if (re.match(r'^/(?:[^ \t]+/(?:chrome-headless-shell|headless_shell|Chromium|chrome)|Applications/Google Chrome[.]app/Contents/MacOS/Google Chrome|[^ \t]+/Google Chrome for Testing[.]app/Contents/MacOS/Google Chrome for Testing)(?:\s|$)', command)
                and '--type=' not in command
                and ('--headless' in command or re.match(r'^/[^ ]*(?:chrome-headless-shell|headless_shell)(?:\s|$)', command))):
            browsers += 1
    return servers, browsers


def main():
    if sys.platform != 'darwin':
        return 0
    units = int(sys.argv[1])
    before, _ = snapshot()
    start = time.monotonic()
    time.sleep(10)
    after, browsers = snapshot()
    elapsed = time.monotonic() - start
    if not before or before.keys() != after.keys():
        print('GPU guard: WindowServer sample unavailable; waiting', file=sys.stderr)
        return 75
    cpu = sum(after[pid] - before[pid] for pid in before) * 100 / elapsed
    if cpu < 0 or cpu > 60 or browsers + units > 2:
        print(f'GPU guard: WindowServer {cpu:.1f}% / 10 s; {browsers} headless browsers + {units} requested; waiting', file=sys.stderr)
        return 75
    return 0


if __name__ == '__main__':
    sys.exit(main())
