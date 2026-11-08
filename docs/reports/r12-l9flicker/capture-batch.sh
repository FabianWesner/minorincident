#!/bin/sh
# e2e-lock treats a shell batch as opaque and reserves the supported external
# exclusive slot. Each SceneSession launches one headless browser and closes it
# before the next starts. This is a visual check, without quiet timing claims.
set -eu
node --import tsx/esm docs/reports/r12-l9flicker/verify-capture.ts webgpu high l9 > docs/reports/r12-l9flicker/l9-webgpu.log 2>&1
node --import tsx/esm docs/reports/r12-l9flicker/verify-capture.ts webgl2 low l9 > docs/reports/r12-l9flicker/l9-webgl2.log 2>&1
node --import tsx/esm docs/reports/r12-l9flicker/verify-capture.ts webgpu high l10 > docs/reports/r12-l9flicker/l10-webgpu.log 2>&1
npm run scene:gate -- --jobs 1 --out test-results/r12-scene-gate > docs/reports/r12-l9flicker/scene-gate.log 2>&1
