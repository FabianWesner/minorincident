#!/bin/sh
set -eu
origin=http://127.0.0.1:4221
export LOAD_OUT=docs/reports/load-stalls/evidence/diagnostic-before
LOAD_TRACE=1 npx tsx tools/perf/cold-load-time.ts "$origin" webgpu low 3 L1
LOAD_TRACE=1 npx tsx tools/perf/cold-load-time.ts "$origin" webgl2 low 3 L1
export LOAD_OUT=docs/reports/load-stalls/evidence/before
for backend in webgpu webgl2; do
  for quality in low high; do
    LOAD_TRACE=0 npx tsx tools/perf/cold-load-time.ts "$origin" "$backend" "$quality" 20 L1
  done
done
