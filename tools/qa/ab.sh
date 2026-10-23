#!/bin/sh
set -eu
export E2E_UNITS=1 E2E_ADMISSION_TIMEOUT_SECONDS=3600 E2E_PORT=4201 SCENE_PORT=4202
if [ "${1:-}" = --help ]; then exec npx tsx tools/qa/ab.ts "$@"; fi
exec sh tools/e2e-lock.sh npx tsx tools/qa/ab.ts "$@"
