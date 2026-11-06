#!/bin/sh
# fix67-a: L3-06 squad census over seeds 1-3 for the given tiers (three node processes at a time).
# Usage: sh tools/qa/fix67/l3-squad.sh <label> [tiers...]
cd "$(dirname "$0")/../../.." || exit 1
label=$1; shift
out=test-results/fix67/squad-$label; mkdir -p "$out"
for tier in ${@:-low high}; do
  for seed in 1 2 3; do node --import tsx/esm tools/qa/fix67/l3-squad.ts $seed $tier > "$out/$tier-$seed.json" 2> "$out/$tier-$seed.err" & done
  wait
done
cat "$out"/*.json
