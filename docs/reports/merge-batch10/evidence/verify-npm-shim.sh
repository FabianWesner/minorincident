#!/bin/sh
is_build=0
for arg in "$@"; do [ "$arg" != build ] || is_build=1; done
if [ "$is_build" = 1 ] && [ "${MI_GATE_BUILD_LOCK:-}" = 1 ]; then
  exec python3 docs/reports/merge-batch10/evidence/bounded-run.py 1200 /bin/sh docs/reports/merge-batch10/evidence/exclusive-build.sh /opt/homebrew/bin/npm "$@"
fi
if [ "$1" = run ] && [ "$2" = build ] && [ -n "${MI_VERIFY_BUILD_DIR:-}" ]; then
  exec /opt/homebrew/bin/npm "$@" -- --outDir "$MI_VERIFY_BUILD_DIR"
fi
exec /opt/homebrew/bin/npm "$@"
