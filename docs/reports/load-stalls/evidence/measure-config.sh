#!/bin/sh
set -eu
level=$1 backend=$2 quality=$3
started=$(date +%s)
if [ ! -f test-results/load-stalls/quick-candidate-passed ]; then
  for check_backend in webgl2 webgpu; do
    for check_quality in high low; do
      LOAD_OUT=docs/reports/load-stalls/evidence/diagnostic-indexed LOAD_TRACE=0 LOAD_GAMEPLAY_MS=0 npx tsx tools/perf/cold-load-time.ts http://127.0.0.1:4222 "$check_backend" "$check_quality" 3 L10
    done
  done
  # Review the indexed bake before starting its acceptance matrix.
  exit 86
fi
export LOAD_TRACE=0
export LOAD_BASELINE=docs/reports/load-stalls/evidence/before
if [ ! -f "$LOAD_BASELINE/$level-$backend-$quality-summary.json" ]; then
  LOAD_OUT="$LOAD_BASELINE" LOAD_GAMEPLAY_MS=0 npx tsx tools/perf/cold-load-time.ts http://127.0.0.1:4221 "$backend" "$quality" 20 "$level"
fi
# Leave enough reservation time for the cold observations and movement segment.
if [ "$(($(date +%s) - started))" -gt 600 ]; then exit 85; fi
LOAD_OUT=docs/reports/load-stalls/evidence/after LOAD_GAMEPLAY_MS=10000 LOAD_GAMEPLAY_LAST=1 LOAD_ASSERT=1 npx tsx tools/perf/cold-load-time.ts http://127.0.0.1:4222 "$backend" "$quality" 20 "$level"
