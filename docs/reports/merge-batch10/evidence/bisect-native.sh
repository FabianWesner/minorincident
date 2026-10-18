#!/bin/sh
status=0
for lane in pair1 vfx; do
  case "$lane" in pair1) port=3441;; vfx) port=3442;; esac
  E2E_PORT=$port VFX_DIST=/tmp/merge-batch10-bisect-$lane/dist npx playwright test --config tools/scenelab/vfx-stunning.config.ts tests/perf/explosions.spec.ts --project=chromium --workers=1 || status=1
  mkdir -p docs/reports/merge-batch10/perf/bisect-$lane
  cp test-results/epics/E27/perf-high.json test-results/epics/E27/perf-low.json docs/reports/merge-batch10/perf/bisect-$lane/
  cp tools/scenelab/test-results/vfx-stunning/browser-$port.json docs/reports/merge-batch10/perf/bisect-$lane/playwright.json
done
exit "$status"
