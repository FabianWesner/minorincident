#!/bin/sh
run() {
  qa_name=$1
  shift
  SCENE_PORT=4351 E2E_SERIAL=1 E2E_UNITS=1 E2E_RESERVATION_SECONDS=600 BROWSER_POOL_JOB_ID=qa-browser2 sh tools/e2e-lock.sh node --import tsx "$@" > "/private/tmp/qa-browser2-$qa_name.log" 2>&1
  printf '%s\t%s\n' "$qa_name" "$?" >> /private/tmp/qa-browser2-supplement-status.tsv
}
run l8-diagnostic docs/reports/qa-browser2/l8-diagnostic.ts
for qa_tier in low high; do
  for qa_backend in webgl2 webgpu; do
    QA_SUFFIX=shutter QA_BOUND_SECONDS=180 QA_MAX_DEATHS=3 QA_SEED=1 run "L5-$qa_tier-$qa_backend-shutter" docs/reports/qa-browser2/route.ts L5 "$qa_tier" "$qa_backend" complete
  done
done
QA_SUFFIX=crash-source QA_BOUND_SECONDS=180 QA_MAX_DEATHS=3 QA_SEED=42 run L9-low-webgpu-crash-source docs/reports/qa-browser2/route.ts L9 low webgpu complete
for qa_tier in low high; do
  for qa_backend in webgl2 webgpu; do
    run "crash-$qa_tier-$qa_backend" docs/reports/qa-browser2/crash.ts "$qa_tier" "$qa_backend"
  done
done
for qa_backend in webgl2 webgpu; do
  QA_SUFFIX=keyboard run "course-low-$qa_backend-keyboard" docs/reports/qa-browser2/course.ts low "$qa_backend"
  QA_SUFFIX=reframed run "finds-low-$qa_backend-reframed" docs/reports/qa-browser2/finds.ts low "$qa_backend"
done
run destruction-low-webgl2-repeat docs/reports/qa-browser2/destruction.ts low webgl2
for qa_tier in low high; do
  for qa_backend in webgl2 webgpu; do
    run "fuel-$qa_tier-$qa_backend" docs/reports/qa-browser2/fuel.ts "$qa_tier" "$qa_backend"
  done
done
for qa_tier in low high; do
  for qa_backend in webgl2 webgpu; do
    run "departure-$qa_tier-$qa_backend" docs/reports/qa-browser2/departure.ts "$qa_tier" "$qa_backend"
  done
done
run destruction-original tools/scenelab/destruction.ts
if [ -f docs/reports/r13-destruction/capture.json ]; then
  cp docs/reports/r13-destruction/capture.json docs/reports/qa-browser2/destruction-original.json
fi
for qa_level in L9 L10; do
  for qa_tier in low high; do
    for qa_backend in webgl2 webgpu; do
      QA_SUFFIX=reframed QA_REFRAME=1 run "rollout-$qa_level-$qa_tier-$qa_backend-reframed" docs/reports/qa-browser2/rollout.ts "$qa_level" "$qa_tier" "$qa_backend"
    done
  done
done
SCENE_PORT=4351 SCENE_SERVER=preview E2E_RESERVATION_SECONDS=600 E2E_ADMISSION_TIMEOUT_SECONDS=120 MI_PERF_ADMISSION_TIMEOUT_SECONDS=120 BROWSER_POOL_JOB_ID=qa-browser2 PERF_CONDITIONS_LOG=/private/tmp/qa-browser2-perf-conditions.jsonl sh tools/perf/quiet-run.sh node --import tsx docs/reports/qa-browser2/perf.ts > /private/tmp/qa-browser2-perf.log 2>&1
printf 'quiet-performance\t%s\n' "$?" >> /private/tmp/qa-browser2-supplement-status.tsv
SCENE_PORT=4351 E2E_SERIAL=1 E2E_UNITS=1 E2E_RESERVATION_SECONDS=600 BROWSER_POOL_JOB_ID=qa-browser2 npm run scene:gate -- --jobs 1 --out /private/tmp/qa-browser2-scene-gate > /private/tmp/qa-browser2-scene-gate.log 2>&1
printf 'scene-gate\t%s\n' "$?" >> /private/tmp/qa-browser2-supplement-status.tsv
E2E_PORT=4351 E2E_SERIAL=1 E2E_UNITS=1 E2E_RESERVATION_SECONDS=600 BROWSER_POOL_JOB_ID=qa-browser2 sh tools/e2e-lock.sh npx playwright test --project=chromium --grep @smoke --grep-invert 'webgpu|WebGPU' --workers=1 > /private/tmp/qa-browser2-smoke.log 2>&1
printf 'webgl-smoke\t%s\n' "$?" >> /private/tmp/qa-browser2-supplement-status.tsv
if [ -f test-results/playwright/results.json ]; then
  cp test-results/playwright/results.json docs/reports/qa-browser2/smoke.json
fi
