#!/bin/sh
set -eu
export E2E_PORT=4221 SCENE_PORT=4222 E2E_UNITS=1 E2E_ADMISSION_TIMEOUT_SECONDS=3600
export PERF_CONDITIONS_LOG="$PWD/docs/reports/load-stalls/evidence/conditions.jsonl"
# Short configurations can share a reservation. Every batch releases its slots;
# measure-batch releases early when its observed duration needs another window.
while IFS= read -r batch; do
  while :; do
    rc=0
    # These are fixed configuration tokens, intentionally split into arguments.
    sh tools/perf/quiet-run.sh sh tools/e2e-lock.sh sh docs/reports/load-stalls/evidence/measure-batch.sh $batch || rc=$?
    if [ "$rc" = 0 ]; then break; fi
    if [ "$rc" != 85 ]; then exit "$rc"; fi
  done
done <<'BATCHES'
L1:webgpu:high L1:webgpu:low L1:webgl2:high L1:webgl2:low
L10:webgl2:high L10:webgl2:low L10:webgpu:high L10:webgpu:low
L8:webgpu:high L8:webgpu:low
L8:webgl2:high L8:webgl2:low
L7:webgl2:high L7:webgl2:low L7:webgpu:high L7:webgpu:low
L4:webgl2:high L4:webgl2:low L4:webgpu:high L4:webgpu:low
BATCHES
