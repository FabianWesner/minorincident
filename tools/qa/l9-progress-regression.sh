#!/bin/sh
# Native full L9 route regression: ordinary held-W steering, seeds 1–3.
# Each child writes its complete receipt before reporting a failed invariant.
set -u
cd "$(dirname "$0")/../.." || exit 1
status=0
for path in primary detour; do
  for route in road countryside dry-shortcut; do
    for seed in 1 2 3; do
      L9_PROGRESS_PATH="$path" node --import tsx/esm tools/qa/l9-progress-probe.ts "$seed" "$route" --check || status=1
    done
  done
done
exit "$status"
