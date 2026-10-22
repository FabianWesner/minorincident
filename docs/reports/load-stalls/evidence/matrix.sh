#!/bin/sh
set -eu
# Candidate diagnostics must finish, and their result must be reviewed first.
while [ ! -f test-results/load-stalls/candidate-accepted ]; do sleep 10; done
export E2E_PORT=4221 SCENE_PORT=4222 E2E_UNITS=1 E2E_ADMISSION_TIMEOUT_SECONDS=3600
export PERF_CONDITIONS_LOG="$PWD/docs/reports/load-stalls/evidence/conditions.jsonl"
for level in L8 L10 L1 L4 L7; do
  for backend in webgl2 webgpu; do
    for quality in low high; do
      rc=0
      sh tools/perf/quiet-run.sh sh tools/e2e-lock.sh sh docs/reports/load-stalls/evidence/measure-config.sh "$level" "$backend" "$quality" || rc=$?
      if [ "$rc" = 85 ]; then
        sh tools/perf/quiet-run.sh sh tools/e2e-lock.sh sh docs/reports/load-stalls/evidence/measure-config.sh "$level" "$backend" "$quality"
      elif [ "$rc" != 0 ]; then exit "$rc"; fi
    done
  done
done
