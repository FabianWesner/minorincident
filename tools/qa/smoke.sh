#!/bin/sh
# Both artifacts share the one smoke wall-time budget owned by test-budget.mjs.
set -eu
npm run build:qa
# The two backend limit checks compile independently; use the permitted two
# pooled contexts so their full scene/variant coverage fits the smoke budget.
sh tools/e2e-lock.sh npx playwright test --project=chromium --grep @smoke --workers=2
npm run build
E2E_PUBLIC_BUILD=1 E2E_DIST=dist sh tools/e2e-lock.sh npx playwright test --project=chromium --grep @public-smoke --workers=1
