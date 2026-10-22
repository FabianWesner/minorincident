#!/bin/sh
set -eu
test -f dist-l9/index.html
# Preserve old chunks for graphs already loaded by previous completed batches.
rsync -a dist-l9/ dist/
shasum -a 256 dist/index.html
exec sh tools/e2e-lock.sh npx playwright test tests/e2e/levels/l9-player-readability.spec.ts --project=chromium --workers=1
