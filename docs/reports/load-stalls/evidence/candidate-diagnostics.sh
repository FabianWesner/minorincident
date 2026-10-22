#!/bin/sh
set -eu
export LOAD_OUT=docs/reports/load-stalls/evidence/diagnostic-population
for level in L8 L10; do
  for backend in webgpu webgl2; do
    LOAD_TRACE=1 LOAD_GAMEPLAY_MS=10000 npx tsx tools/perf/cold-load-time.ts http://127.0.0.1:4222 "$backend" low 1 "$level"
  done
done
