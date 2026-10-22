#!/bin/sh
set -eu
export LOAD_TRACE=1 LOAD_OUT=docs/reports/load-stalls/evidence/diagnostic-levels
for level in L4 L7 L10; do
  for backend in webgpu webgl2; do
    for quality in low high; do
      npx tsx tools/perf/cold-load-time.ts http://127.0.0.1:4221 "$backend" "$quality" 1 "$level"
    done
  done
done
