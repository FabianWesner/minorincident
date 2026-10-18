#!/bin/sh
E2E_PORT=3443 npx playwright test tests/perf/explosions.spec.ts tests/perf/e18-desktop.spec.ts --project=chromium --workers=1
status=$?
mkdir -p docs/reports/merge-batch10/perf/warmed
cp test-results/epics/E27/perf-high.json test-results/epics/E27/perf-low.json docs/reports/merge-batch10/perf/warmed/
cp test-results/epics/E18/desktop-gpu.json docs/reports/merge-batch10/perf/warmed/
cp test-results/playwright/results.json docs/reports/merge-batch10/perf/warmed/playwright.json
exit "$status"
