#!/bin/sh
set -eu
l10_root=$1
l10_baseline=$2
for backend in webgpu webgl2; do
  cd "$l10_baseline"
  L10_PROFILE=1 L10_GPU_DIAGNOSTICS=1 L10_BACKEND="$backend" L10_TIER=low L10_OUT="$l10_root/test-results/fixes-13h-l10/depth-real-time-matrix/$backend-before-low" npx tsx tools/qa/l10-real-play.ts --timing --real-time
  cd "$l10_root"
  L10_PROFILE=1 L10_GPU_DIAGNOSTICS=1 L10_BACKEND="$backend" L10_TIER=low L10_OUT="test-results/fixes-13h-l10/depth-real-time-matrix/$backend-after-low" npx tsx tools/qa/l10-real-play.ts --timing --real-time
done
set +e
node docs/reports/fixes-13h-l10/evidence/verify-real-play.mjs test-results/fixes-13h-l10/depth-real-time-matrix --low-only
l10_audit=$?
set -e
sh /tmp/fixes-13h-l10-production-baseline.sh "$l10_root" "$l10_baseline"
exit "$l10_audit"
