#!/bin/sh
set -eu
origin=http://127.0.0.1:4221
export LOAD_OUT=docs/reports/load-stalls/evidence/diagnostic-before
LOAD_TRACE=1 npx tsx tools/perf/cold-load-time.ts "$origin" webgpu low 3 L1 0,30000
LOAD_TRACE=1 npx tsx tools/perf/cold-load-time.ts "$origin" webgl2 low 3 L1 0,30000
export LOAD_OUT=docs/reports/load-stalls/evidence/before
for backend in webgpu webgl2; do
  for quality in low high; do
    LOAD_TRACE=0 npx tsx tools/perf/cold-load-time.ts "$origin" "$backend" "$quality" 20 L1
  done
done

LOAD_OUT=docs/reports/load-stalls/evidence/diagnostic-L8 LOAD_TRACE=1 npx tsx tools/perf/cold-load-time.ts "$origin" webgpu low 1 L8
for level in L1 L7 L8 L10; do
  LOAD_OUT=docs/reports/load-stalls/evidence/diagnostic-async LOAD_TRACE=1 npx tsx tools/perf/cold-load-time.ts http://127.0.0.1:4222 webgpu low 1 "$level"
done
