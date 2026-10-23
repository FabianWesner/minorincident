#!/bin/sh
set -eu
npx playwright test --config tools/perf/load-playwright.config.ts --grep @smoke --workers=1
