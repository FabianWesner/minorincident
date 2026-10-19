#!/bin/sh
# Route survey captures for dress-l9: tools/qa/l9-capture.sh <tag> ; outputs test-results/l9cap/<tag>-<tier>-z<zoom>/shot-*.png
# Step 40 m along all three routes, zoom 0.5/1/1.5, high and low, WebGPU. Uses npm run scene (tools/e2e-lock.sh inside).
tag=$1
mkdir -p test-results/l9
for zoom in ${ZOOMS:-0.5 1 1.5}; do
  SHOTS=1 python3 tools/qa/l9-survey-gen.py all 40 $zoom test-results/l9/s-$zoom.json 8 >/dev/null
  for tier in ${TIERS:-high low}; do
    SCENE_PORT=3361 npm run scene -- test-results/l9/s-$zoom.json --backend webgpu --tier $tier --out test-results/l9cap/$tag-$tier-z$zoom 2>&1 | grep -E '"pass"|"failed"|Error'
  done
done
echo finished
