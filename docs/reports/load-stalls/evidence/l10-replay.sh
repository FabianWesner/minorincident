#!/bin/sh
set -eu
export L10_ENTRY_OUT=docs/reports/load-stalls/evidence/l10-entry
npx playwright test --config test-results/load-stalls/playwright.config.mts tests/perf/l10-entry-hitches.spec.ts --project=chromium --workers=1
