#!/bin/sh
# Orchestrator browser deploy gate (docs/qa/deploy-gate.md steps 2-5). Unit + levels run remotely separately.
cd "${1:-/Users/wesner/Workspace/minorincident}"
git log --oneline -1
npm run -s typecheck >/dev/null 2>&1; echo tc=$?
npm run -s lint >/dev/null 2>&1; echo lint=$?
npm run -s build >/dev/null 2>&1; echo build=$?
E2E_PORT=3401 npm run -s test:smoke 2>&1 | grep -E "Tests |passed|failed" | tail -3
SCENE_SERVER=preview SCENE_PORT=3402 npm run -s scene:matrix >/dev/null 2>&1; echo matrix=$?; head -3 test-results/scene-catalog/index.md | tail -1 | cut -c1-80
E2E_PORT=3401 E2E_UNITS=2 sh tools/e2e-lock.sh npx playwright test --project=chromium --workers=2 --retries=1 levels/L1.spec levels/L2.spec levels/L4.spec l4-po-round l4-cellar-guidance l4-plaza-movement l4-barricade-prompts cellar-position l4-blank-viewport webgpu-canvas respawn-bat input-mouse crowd-visible-outbreak menu-10-levels l10-finale l10-cure 2>&1 | grep -E "✘|passed|failed|flaky" | tail -15
echo GATE-END
