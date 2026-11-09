#!/bin/sh
for qa_tier in low high; do
  for qa_backend in webgl2 webgpu; do
    SCENE_PORT=4351 E2E_SERIAL=1 E2E_UNITS=1 E2E_RESERVATION_SECONDS=600 BROWSER_POOL_JOB_ID=qa-browser2 sh tools/e2e-lock.sh node --import tsx docs/reports/qa-browser2/po-spots.ts "$qa_tier" "$qa_backend" > "/private/tmp/qa-browser2-po-$qa_tier-$qa_backend.log" 2>&1
    printf 'po-%s-%s\t%s\n' "$qa_tier" "$qa_backend" "$?" >> /private/tmp/qa-browser2-po-status.tsv
  done
done
for qa_tier in low high; do
  for qa_backend in webgl2 webgpu; do
    SCENE_PORT=4351 E2E_SERIAL=1 E2E_UNITS=1 E2E_RESERVATION_SECONDS=600 BROWSER_POOL_JOB_ID=qa-browser2 sh tools/e2e-lock.sh node --import tsx docs/reports/qa-browser2/crash.ts "$qa_tier" "$qa_backend" > "/private/tmp/qa-browser2-crash-final-$qa_tier-$qa_backend.log" 2>&1
    printf 'crash-final-%s-%s\t%s\n' "$qa_tier" "$qa_backend" "$?" >> /private/tmp/qa-browser2-po-status.tsv
  done
done
for qa_begin in 0 1; do
  QA_BEGIN="$qa_begin" SCENE_PORT=4351 E2E_SERIAL=1 E2E_UNITS=1 E2E_RESERVATION_SECONDS=600 BROWSER_POOL_JOB_ID=qa-browser2 sh tools/e2e-lock.sh node --import tsx docs/reports/qa-browser2/original-destruction.ts > "/private/tmp/qa-browser2-destruction-operator-$qa_begin.log" 2>&1
  printf 'destruction-operator-%s\t%s\n' "$qa_begin" "$?" >> /private/tmp/qa-browser2-po-status.tsv
done
for qa_tier in low high; do
  for qa_backend in webgl2 webgpu; do
    SCENE_PORT=4351 E2E_SERIAL=1 E2E_UNITS=1 E2E_RESERVATION_SECONDS=600 BROWSER_POOL_JOB_ID=qa-browser2 sh tools/e2e-lock.sh node --import tsx docs/reports/qa-browser2/departure.ts "$qa_tier" "$qa_backend" > "/private/tmp/qa-browser2-departure-fullnav-$qa_tier-$qa_backend.log" 2>&1
    printf 'departure-fullnav-%s-%s\t%s\n' "$qa_tier" "$qa_backend" "$?" >> /private/tmp/qa-browser2-po-status.tsv
  done
done
