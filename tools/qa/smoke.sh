#!/bin/sh
# Both artifacts share the one smoke wall-time budget owned by test-budget.mjs.
set -eu
npm run build:qa
# Allow constrained lanes to reserve a single browser.
sh tools/e2e-lock.sh npx playwright test --project=chromium --grep @smoke --workers="${SMOKE_WORKERS:-2}"
npm run build
E2E_PUBLIC_BUILD=1 E2E_DIST=dist sh tools/e2e-lock.sh npx playwright test --project=chromium --grep @public-smoke --workers=1
