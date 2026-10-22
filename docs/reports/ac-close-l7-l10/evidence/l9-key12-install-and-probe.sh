#!/bin/sh
set -eu
test -f dist-l9-key12/index.html
mkdir -p test-results/epics/E31/player-current-key12
cp dist/index.html test-results/epics/E31/player-current-key12/before-index.html
rsync -a dist-l9-key12/ dist/
shasum -a 256 dist/index.html
exec sh tools/e2e-lock.sh npx playwright test tests/e2e/levels/l9-player-readability.spec.ts --project=chromium --workers=1
