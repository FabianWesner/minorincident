#!/bin/sh
# Limit browser test runs machine-wide: several lanes share one Mac and parallel Playwright runs
# saturate it. E2E_SLOTS (default 1) runs may proceed at once; the rest wait for a free slot.
# Only wrap browser runs, never plain builds. Without lockf (e.g. Linux CI) just run.
# Queue briefly so polling lanes also get a turn among lockf's waiting lanes.
command -v lockf >/dev/null 2>&1 || exec "$@"
base="${E2E_LOCK:-/tmp/minor-incident-e2e.lock}"
slots="${E2E_SLOTS:-1}"
while :; do
  i=0
  while [ "$i" -lt "$slots" ]; do
    lockf -t "${E2E_WAIT:-60}" "$base.$i" "$@" 2>/dev/null; rc=$?
    [ "$rc" -ne 75 ] && exit "$rc"   # 75 = slot busy (EX_TEMPFAIL); anything else is the command's result
    i=$((i + 1))
  done
  sleep 2
done
