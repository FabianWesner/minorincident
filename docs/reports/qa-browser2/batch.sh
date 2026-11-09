#!/bin/sh
# Each child gets a separate bounded pool reservation; never concurrent browsers.
run() {
  qa_name=$1
  shift
  SCENE_PORT=4351 E2E_SERIAL=1 E2E_UNITS=1 E2E_RESERVATION_SECONDS=600 BROWSER_POOL_JOB_ID=qa-browser2 sh tools/e2e-lock.sh node --import tsx "$@" > "/private/tmp/qa-browser2-$qa_name.log" 2>&1
  qa_exit=$?
  printf '%s\t%s\n' "$qa_name" "$qa_exit" >> /private/tmp/qa-browser2-batch-status.tsv
}
for qa_tier in low high; do
  for qa_backend in webgl2 webgpu; do
    run "L8-$qa_tier-$qa_backend" docs/reports/qa-browser2/route.ts L8 "$qa_tier" "$qa_backend" arena-tour
  done
done
for qa_tier in low high; do
  for qa_backend in webgl2 webgpu; do
    run "spots-$qa_tier-$qa_backend" docs/reports/qa-browser2/spots.ts "$qa_tier" "$qa_backend"
  done
done
run hatch docs/reports/qa-browser2/hatch.ts high webgl2
for qa_tier in low high; do
  for qa_backend in webgl2 webgpu; do
    QA_BOUND_SECONDS=180 QA_MAX_DEATHS=3 run "L4-$qa_tier-$qa_backend" docs/reports/qa-browser2/route.ts L4 "$qa_tier" "$qa_backend" complete
  done
done
for qa_level in L9 L10; do
  for qa_tier in low high; do
    for qa_backend in webgl2 webgpu; do
      run "rollout-$qa_level-$qa_tier-$qa_backend" docs/reports/qa-browser2/rollout.ts "$qa_level" "$qa_tier" "$qa_backend"
    done
  done
done
