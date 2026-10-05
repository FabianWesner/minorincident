#!/bin/sh
# Serialize browser test runs machine-wide: several lanes share one Mac and parallel Playwright
# runs (SwiftShader renders on the CPU) saturate it. Without lockf (e.g. Linux CI) just run.
if command -v lockf >/dev/null 2>&1; then
  exec lockf -k "${E2E_LOCK:-/tmp/minor-incident-e2e.lock}" "$@"
fi
exec "$@"
