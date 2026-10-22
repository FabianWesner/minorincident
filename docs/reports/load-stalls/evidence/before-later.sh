#!/bin/sh
set -eu
# Do not overlap the already admitted L1/diagnostic batch.
while kill -0 67571 2>/dev/null; do sleep 10; done
export E2E_PORT=4221 SCENE_PORT=4222 E2E_UNITS=1 E2E_ADMISSION_TIMEOUT_SECONDS=3600
export PERF_CONDITIONS_LOG="$PWD/docs/reports/load-stalls/evidence/conditions.jsonl"
export LOAD_OUT=docs/reports/load-stalls/evidence/before LOAD_TRACE=0
for level in L8 L10 L4 L7; do
  for backend in webgpu webgl2; do
    for quality in low high; do
      sh tools/perf/quiet-run.sh sh tools/e2e-lock.sh npx tsx tools/perf/cold-load-time.ts http://127.0.0.1:4221 "$backend" "$quality" 20 "$level"
    done
  done
done
