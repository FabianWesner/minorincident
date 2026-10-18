#!/bin/sh
# Orchestrator browser gate (10-18): local, at most 2 GPU browsers (tools/e2e-lock.sh, E2E_SLOTS=2).
# The remote SwiftShader matrix (gate-browser.remote-draft.sh) is ~3.5 min/row and not a gate.
set -eu
cd "${1:-/Users/wesner/Workspace/minorincident}"
export SCENE_SERVER=preview
export E2E_SLOTS=2
export E2E_PORT=${E2E_PORT:-3397} SCENE_PORT=${SCENE_PORT:-3393}
git log --oneline -1
npm run typecheck
npm run lint
npm run build
sh tools/e2e-lock.sh npx playwright test --project=chromium --workers=2 --retries=1 --grep @smoke --grep-invert @perf
npm run scene:matrix
sh tools/e2e-lock.sh npx playwright test --project=chromium --workers=2 --retries=1 --grep-invert @perf levels/L1.spec levels/L2.spec levels/L4.spec l4-po-round l4-cellar-guidance l4-plaza-movement l4-barricade-prompts cellar-position l4-blank-viewport webgpu-canvas respawn-bat input-mouse crowd-visible-outbreak menu-10-levels l10-finale l10-cure
sh tools/perf/quiet-run.sh npx playwright test tests/e2e/l1-grade.spec.ts tests/e2e/l1-look.spec.ts --project=chromium --workers=1
echo GATE-END
