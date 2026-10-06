#!/bin/sh
# Limit browser test runs machine-wide: several lanes share one Mac and parallel Playwright runs
# saturate it. E2E_SLOTS (default 2) runs may proceed at once; the rest wait for a free slot.
# Only wrap browser runs, never plain builds. Without lockf (e.g. Linux CI) just run.
command -v lockf >/dev/null 2>&1 || exec "$@"
base="${E2E_LOCK:-/tmp/minor-incident-e2e.lock}"
slots="${E2E_SLOTS:-2}"
while :; do
  i=0
  while [ "$i" -lt "$slots" ]; do
    lockf -t 0 "$base.$i" "$@"; rc=$?
    [ "$rc" -ne 75 ] && exit "$rc"   # 75 = slot busy (EX_TEMPFAIL); anything else is the command's result
    i=$((i + 1))
  done
  sleep 2
done
