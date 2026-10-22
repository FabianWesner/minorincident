#!/bin/sh
set -eu
l10_root=$1
l10_baseline=$2
for backend in webgpu webgl2; do
  cd "$l10_baseline"
  L10_PROFILE=1 L10_BACKEND="$backend" L10_TIER=high L10_OUT="$l10_root/test-results/fixes-13h-l10/accepted-real-time-matrix/$backend-before-high" npx tsx tools/qa/l10-real-play.ts --timing --real-time
  cd "$l10_root"
  L10_PROFILE=1 L10_BACKEND="$backend" L10_TIER=high L10_OUT="test-results/fixes-13h-l10/accepted-real-time-matrix/$backend-after-high" npx tsx tools/qa/l10-real-play.ts --timing --real-time
done
node docs/reports/fixes-13h-l10/evidence/verify-real-play.mjs test-results/fixes-13h-l10/accepted-real-time-matrix
npm run build
L10_ENTRY_OUT=test-results/fixes-13h-l10/accepted-entry-guard npx playwright test tests/perf/l10-entry-hitches.spec.ts --project=chromium --workers=1
