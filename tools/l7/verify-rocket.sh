#!/bin/sh
set -eu
# L7-S2 systems only; native timing stays on the Mac, other checks use Hetzner.
sh tools/remote/run.sh "$PWD" --pull test-results/epics/E29/full-unit.json --pull test-results/epics/E29/checks.json --pull test-results/epics/E29/vitest.json --pull test-results/playwright/results.json -- sh -c 'npm run typecheck && npm run lint && npm run build && npx vitest run tests/unit tests/sim/combat/l7-rocket.test.ts tests/sim/explosions.test.ts tests/sim/ai/alpha.test.ts --maxWorkers=2 --reporter=default --reporter=json --outputFile=test-results/epics/E29/full-unit.json && E2E_PORT=3389 npm run verify -- E29'
