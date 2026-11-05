#!/bin/sh
# l9-night-look: capture all four backend x tier combos of one origin in sequence (one browser at a time).
#   sh tools/qa/l9-night-all.sh <origin> <tag> [combos="webgpu-low webgpu-high webgl-low webgl-high"]
origin=$1; tag=$2
for c in ${3:-webgpu-low webgpu-high webgl-low webgl-high}; do
  r=${c%-*}; q=${c#*-}
  E2E_UNITS=1 E2E_ADMISSION_TIMEOUT_SECONDS=3600 sh tools/e2e-lock.sh npx tsx tools/qa/l9-night-capture.ts "$origin" "$r" "$q" "test-results/l9n/$tag-$c" 2>&1 | tail -2
  python3 tools/qa/l9-night-sheet.py "test-results/l9n/$tag-$c" "test-results/l9n/$tag-$c.jpg" 520
done
