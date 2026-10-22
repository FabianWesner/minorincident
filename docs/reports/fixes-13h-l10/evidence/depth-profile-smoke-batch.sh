#!/bin/sh
set -eu
PLAYTEST_CPU_PROFILE=1 L10_SECONDS=200 L10_OUT=test-results/fixes-13h-l10/depth-extended-profile npx tsx tools/perf/l10-playtest.ts
npx playwright test --grep @smoke --workers=1
