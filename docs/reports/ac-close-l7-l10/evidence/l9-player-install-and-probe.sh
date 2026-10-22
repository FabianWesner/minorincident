#!/bin/sh
set -eu
test -f dist-l9-caption/index.html
# Preserve the previous entry and old chunks for provenance and reversibility.
mkdir -p test-results/epics/E31/player-current
cp dist/index.html test-results/epics/E31/player-current/before-index.html
rsync -a dist-l9-caption/ dist/
shasum -a 256 dist/index.html
exec sh tools/e2e-lock.sh npx playwright test tests/e2e/levels/l9-player-readability.spec.ts --project=chromium --workers=1
