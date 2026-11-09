#!/bin/sh
run() {
  qa_name=$1
  shift
  SCENE_PORT=4351 E2E_SERIAL=1 E2E_UNITS=1 E2E_RESERVATION_SECONDS=600 BROWSER_POOL_JOB_ID=qa-browser2 sh tools/e2e-lock.sh node --import tsx "$@" > "/private/tmp/qa-browser2-$qa_name.log" 2>&1
  qa_exit=$?
  printf '%s\t%s\n' "$qa_name" "$qa_exit" >> /private/tmp/qa-browser2-followup-status.tsv
}
for qa_tier in low high; do
  for qa_backend in webgl2 webgpu; do
    QA_SUFFIX=poststreamfix run "L10-poststreamfix-$qa_tier-$qa_backend" docs/reports/qa-browser2/route.ts L10 "$qa_tier" "$qa_backend" complete
  done
done
for qa_level in L9 L10; do
  for qa_tier in low high; do
    for qa_backend in webgl2 webgpu; do
      run "rollout-$qa_level-$qa_tier-$qa_backend" docs/reports/qa-browser2/rollout.ts "$qa_level" "$qa_tier" "$qa_backend"
    done
  done
done
for qa_tier in low high; do
  for qa_backend in webgl2 webgpu; do
    run "finds-$qa_tier-$qa_backend" docs/reports/qa-browser2/finds.ts "$qa_tier" "$qa_backend"
    run "truck-$qa_tier-$qa_backend" docs/reports/qa-browser2/truck.ts "$qa_tier" "$qa_backend"
    run "course-$qa_tier-$qa_backend" docs/reports/qa-browser2/course.ts "$qa_tier" "$qa_backend"
    run "extras-$qa_tier-$qa_backend" docs/reports/qa-browser2/extras.ts "$qa_tier" "$qa_backend"
    run "destruction-$qa_tier-$qa_backend" docs/reports/qa-browser2/destruction.ts "$qa_tier" "$qa_backend"
    QA_PORTRAIT=1 QA_SKIP=1 run "portrait-$qa_tier-$qa_backend" docs/reports/qa-browser2/ending.ts "$qa_tier" "$qa_backend"
  done
done
for qa_level in L3 L5 L6 L7; do
  for qa_tier in low high; do
    for qa_backend in webgl2 webgpu; do
      QA_BOUND_SECONDS=180 QA_MAX_DEATHS=3 QA_SEED=1 run "$qa_level-$qa_tier-$qa_backend" docs/reports/qa-browser2/route.ts "$qa_level" "$qa_tier" "$qa_backend" complete
    done
  done
done
for qa_tier in low high; do
  QA_SEED=1 QA_SUFFIX=seed1 QA_BOUND_SECONDS=180 QA_MAX_DEATHS=3 run "L9-$qa_tier-webgpu" docs/reports/qa-browser2/route.ts L9 "$qa_tier" webgpu complete
done
