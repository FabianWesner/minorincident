#!/bin/bash
# Run through tools/remote/run.sh; hold the other runner slot for Vitest's initial timing project.
# Example: sh tools/remote/run.sh "$PWD" -- bash tools/remote/timing-isolated.sh npx vitest run tests/unit tests/levels tests/sim --maxWorkers=4
set -euo pipefail
own=$(readlink /proc/self/fd/9)
case "$own" in
  /srv/mi/locks/slot.0) release=11 ;;
  /srv/mi/locks/slot.1) release=10 ;;
  *) echo '[runner] timing isolation requires the two-slot remote launcher' >&2; exit 64 ;;
esac
# Always acquire in the same order, so two isolated jobs cannot deadlock
# while each holds its launcher's slot and waits for the other's.
flock -u 9
exec 10>/srv/mi/locks/slot.0
exec 11>/srv/mi/locks/slot.1
echo '[runner] waiting for both slots to isolate wall-clock timing'
flock 10
flock 11
echo '[runner] both slots held for the timing project'
"$@" 2>&1 | {
  released=false
  while IFS= read -r line || [ -n "$line" ]; do
    printf '%s\n' "$line"
    if ! $released && [[ "$line" == *' functional '* ]]; then
      flock -u "$release"
      released=true
      echo '[runner] functional phase reached; extra slot released'
    fi
  done
}
