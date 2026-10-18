#!/bin/sh
E2E_PORT=3444 VFX_DIST=/tmp/merge-batch10-bisect-vfx/dist-atmosphere npx playwright test --config tools/scenelab/vfx-stunning.config.ts tests/perf/explosions.spec.ts --project=chromium --workers=1
run_rc=$?
mkdir -p docs/reports/merge-batch10/perf/bisect-atmosphere
cp test-results/epics/E27/perf-high.json test-results/epics/E27/perf-low.json docs/reports/merge-batch10/perf/bisect-atmosphere/
cp tools/scenelab/test-results/vfx-stunning/browser-3444.json docs/reports/merge-batch10/perf/bisect-atmosphere/playwright.json
sh docs/reports/merge-batch10/evidence/warmed-native.sh
warm_rc=$?
[ "$run_rc" -eq 0 ] && exit "$warm_rc"
exit "$run_rc"
