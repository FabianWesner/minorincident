#!/bin/sh
set -eu
level=$1 backend=$2 quality=$3
export LOAD_TRACE=0
export LOAD_BASELINE=docs/reports/load-stalls/evidence/before
if [ ! -f "$LOAD_BASELINE/$level-$backend-$quality-summary.json" ]; then
  LOAD_OUT="$LOAD_BASELINE" LOAD_GAMEPLAY_MS=0 npx tsx tools/perf/cold-load-time.ts http://127.0.0.1:4221 "$backend" "$quality" 20 "$level"
fi
LOAD_OUT=docs/reports/load-stalls/evidence/after LOAD_GAMEPLAY_MS=10000 LOAD_ASSERT=1 npx tsx tools/perf/cold-load-time.ts http://127.0.0.1:4222 "$backend" "$quality" 20 "$level"
