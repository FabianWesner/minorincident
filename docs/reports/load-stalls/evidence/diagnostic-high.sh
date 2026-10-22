#!/bin/sh
set -eu
export LOAD_TRACE=1 LOAD_OUT=docs/reports/load-stalls/evidence/diagnostic-high
for backend in webgpu webgl2; do
  npx tsx tools/perf/cold-load-time.ts http://127.0.0.1:4221 "$backend" high 5 L1
done
