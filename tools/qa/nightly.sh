#!/bin/sh
# Nightly layer (docs/qa/test-strategy.md). The L1 -> credits campaign is the longest single file (~18 min on a runner),
# so it starts at once in its own process while two workers run the rest; the sim budget runs alone afterwards.
# Extra arguments (e.g. reporters) are passed to every Vitest call.
set -u
npx vitest run tests/nightly/campaign.test.ts --configLoader runner --maxWorkers=1 "$@" &
campaign=$!
npx vitest run --project nightly --configLoader runner --maxWorkers=2 --exclude tests/nightly/campaign.test.ts --exclude tests/nightly/sim-budget.test.ts "$@"
rest=$?
wait "$campaign"
run=$?
npx vitest run tests/nightly/sim-budget.test.ts --configLoader runner --maxWorkers=1 "$@"
budget=$?
echo "[nightly] campaign=$run rest=$rest sim-budget=$budget"
[ "$run" = 0 ] && [ "$rest" = 0 ] && [ "$budget" = 0 ]
