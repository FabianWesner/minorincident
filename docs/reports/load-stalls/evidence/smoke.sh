#!/bin/sh
set -eu
npx playwright test --config test-results/load-stalls/playwright.config.mts --grep @smoke --workers=1
