#!/bin/sh
# Opt-in functional Chromium tests with software rendering; the deploy gate stays local.
set -eu
if [ "${MI_REMOTE:-}" != 1 ]; then
  exec sh tools/remote/run.sh "$PWD" --pull test-results/playwright --env "E2E_PORT=${E2E_PORT:-$((34000 + $$ % 10000))}" -- sh tools/remote/e2e.sh "$@"
fi
npm run build
exec npx playwright test --project=chromium --workers=1 --grep-invert '[Ww]eb[Gg][Pp][Uu]|@perf|@gpu' "$@"
