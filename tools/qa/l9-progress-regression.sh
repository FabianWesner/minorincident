#!/bin/sh
# Native full L9 road regression: ordinary held-W steering, seeds 1–3.
# Each child writes its complete receipt before reporting a failed invariant.
set -u
cd "$(dirname "$0")/../.." || exit 1
status=0
for seed in 1 2 3; do
  node --import tsx/esm tools/qa/l9-progress-probe.ts "$seed" road --check || status=1
done
exit "$status"
