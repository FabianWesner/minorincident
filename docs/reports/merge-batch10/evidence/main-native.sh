#!/bin/sh
root=/Users/wesner/Workspace/minorincident/.claude/worktrees/merge-batch10
cd /tmp/merge-batch10-main-control || exit 1
E2E_PORT=3417 npx playwright test tests/perf/explosions.spec.ts tests/perf/e18-desktop.spec.ts --project=chromium --workers=1
status=$?
mkdir -p "$root/docs/reports/merge-batch10/perf/main"
cp test-results/epics/E27/perf-*.json "$root/docs/reports/merge-batch10/perf/main/"
cp test-results/epics/E18/desktop-gpu.json "$root/docs/reports/merge-batch10/perf/main/"
cp test-results/playwright/results.json "$root/docs/reports/merge-batch10/perf/main/playwright.json"
exit "$status"
