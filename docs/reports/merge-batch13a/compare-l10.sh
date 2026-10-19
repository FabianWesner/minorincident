#!/bin/sh
set -u
npx vitest run tests/sim/levels/l10-campus-corridor.test.ts -t T-E32-03-D3-high --maxWorkers=1
merged_status=$?
tar -xzf docs/reports/merge-batch13a/main-src.tar.gz
npx vitest run tests/sim/levels/l10-campus-corridor.test.ts -t T-E32-03-D3-high --maxWorkers=1
main_status=$?
printf 'L10 comparison: merged=%s main=%s\n' "$merged_status" "$main_status"
[ "$merged_status" -eq 0 ] && [ "$main_status" -eq 0 ]
