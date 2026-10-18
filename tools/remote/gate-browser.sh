#!/bin/sh
# Reviewable implementation of the machine-local orchestrator entry point.
set -eu
cd "${1:-.}"
export SCENE_SERVER=preview
export E2E_PORT=${E2E_PORT:-$((34000 + $$ % 10000))} SCENE_PORT=${SCENE_PORT:-$((44000 + $$ % 10000))}
git log --oneline -1
npm run typecheck
npm run lint
npm run build
# Remote software-rendered functional coverage and the complete WebGL2 deploy matrix.
sh tools/remote/run.sh "$PWD" --pull test-results/playwright --env "E2E_PORT=$E2E_PORT" -- sh -c 'npm run build && npx playwright test --project=chromium --workers=1 --retries=1 --grep @smoke --grep-invert "[Ww]eb[Gg][Pp][Uu]|@perf"'
sh tools/remote/run.sh "$PWD" --pull test-results/scene-catalog-webgl2 --env SCENE_SERVER=preview --env "SCENE_PORT=$SCENE_PORT" -- sh -c 'npm run build && npm run scene:matrix -- --backend webgl2 --out test-results/scene-catalog-webgl2'
sh tools/remote/run.sh "$PWD" --pull test-results/playwright --env "E2E_PORT=$E2E_PORT" -- sh -c 'npm run build && npx playwright test --project=chromium --workers=1 --retries=1 --grep-invert "[Ww]eb[Gg][Pp][Uu]|@perf|@gpu" "$@"' sh levels/L1.spec levels/L2.spec levels/L4.spec l4-po-round l4-cellar-guidance l4-plaza-movement l4-barricade-prompts cellar-position l4-blank-viewport webgpu-canvas respawn-bat input-mouse crowd-visible-outbreak menu-10-levels l10-finale l10-cure
# Native coverage is retained, including mixed-backend tests' WebGPU cases.
npm run scene:matrix -- --backend webgpu --out test-results/scene-catalog-webgpu
sh tools/e2e-lock.sh npx playwright test --project=chromium --workers=2 --retries=1 --grep '[Ww]eb[Gg][Pp][Uu]' levels/L1.spec levels/L2.spec levels/L4.spec l4-po-round l4-cellar-guidance l4-plaza-movement l4-barricade-prompts cellar-position l4-blank-viewport webgpu-canvas respawn-bat input-mouse crowd-visible-outbreak menu-10-levels l10-finale l10-cure
# Native smoke outside this selection (e.g. WebGPU capability) remains local.
sh tools/e2e-lock.sh npx playwright test --project=chromium --workers=2 --grep '(?=.*@smoke)(?=.*[Ww]eb[Gg][Pp][Uu])'
sh tools/perf/quiet-run.sh npx playwright test tests/e2e/l1-grade.spec.ts tests/e2e/l1-look.spec.ts --project=chromium --workers=1
echo GATE-END
