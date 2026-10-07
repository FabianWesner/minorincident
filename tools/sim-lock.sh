#!/bin/sh
# Limit heavy Vitest runs (tests/sim, tests/levels, full test:unit) machine-wide: several lanes share one Mac and parallel test runs
# saturate it. SIM_SLOTS (default 2) runs may proceed at once; the rest wait for a free slot.
# Wrap heavy sim/unit runs, never plain builds. Without lockf (e.g. Linux CI) just run.
# SIM_WAIT (seconds, default 0) queues on a slot instead of polling when validation is starved.
command -v lockf >/dev/null 2>&1 || exec "$@"
# Re-entrant: a command already running under this lock (e.g. verify inside an outer wrapper) must not take a second slot.
[ -n "${MI_SIM_LOCK_HELD:-}" ] && exec "$@"
export MI_SIM_LOCK_HELD=1
base="${SIM_LOCK:-/tmp/minor-incident-sim.lock}"
slots="${SIM_SLOTS:-2}"
while :; do
  i=0
  while [ "$i" -lt "$slots" ]; do
    # Keep the inode: unlinking a lock file splits queued and newly arriving users.
    lockf -k -t "${SIM_WAIT:-0}" "$base.$i" "$@" 2>/dev/null; rc=$?
    [ "$rc" -ne 75 ] && exit "$rc"   # 75 = slot busy (EX_TEMPFAIL); anything else is the command's result
    i=$((i + 1))
  done
  sleep 2
done
