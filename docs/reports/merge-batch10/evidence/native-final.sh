#!/bin/sh
E2E_PORT=3483 VFX_DIST="$PWD/test-results/merge-batch10/gate-stage-dist" SCENE_SERVER=preview SCENE_DIST="$PWD/test-results/merge-batch10/gate-stage-dist" SCENE_PORT=3484 npx playwright test --config tools/scenelab/vfx-stunning.config.ts tests/perf/explosions.spec.ts tests/perf/e18-desktop.spec.ts tests/perf/e25-lighting.spec.ts tests/perf/e25-light-lab.spec.ts tests/perf/weather.spec.ts --project=chromium --workers=1
run_rc=$?
mkdir -p docs/reports/merge-batch10/perf/final
cp test-results/epics/E27/perf-high.json test-results/epics/E27/perf-low.json docs/reports/merge-batch10/perf/final/
cp -R test-results/epics/E28/perf docs/reports/merge-batch10/perf/final/weather
cp tools/scenelab/test-results/vfx-stunning/browser-3483.json docs/reports/merge-batch10/perf/final/playwright.json
exit "$run_rc"
