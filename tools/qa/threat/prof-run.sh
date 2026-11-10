#!/bin/sh
# Diagnostic: CPU-profile one passive window (default L5, 150 sim seconds) and print the hot functions.
# Usage: tools/qa/threat/prof-run.sh [level=L5] [simSeconds=150]
rm -rf /tmp/prof23
FLAG_BENCH_ONLY=base NODE_OPTIONS="--cpu-prof --cpu-prof-dir=/tmp/prof23" node --import tsx/esm tools/qa/threat/flag-bench.ts 1 "${2:-150}" "${1:-L5}" || exit 1
unset NODE_OPTIONS
node tools/qa/threat/prof-summary.mjs /tmp/prof23 40
