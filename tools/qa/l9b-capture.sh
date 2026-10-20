#!/bin/sh
# look-l9b before/after captures: tools/qa/l9b-capture.sh <tag> [stretch ...]
# Writes test-results/l9b/<tag>-<tier>/l9look-<stretch>-z<zoom>/shot-*.png for ZOOMS (default 1,1.5) and TIERS (default high low),
# one Scene Lab session per tier (BACKEND default webgpu). SCENE_PORT must be unique per lane.
tag=$1; shift
zooms=${ZOOMS:-1,1.5}
mkdir -p test-results/l9b/specs-$tag
python3 tools/qa/l9-look-gen.py test-results/l9b/specs-$tag "$zooms" >/dev/null
specs=""
for s in ${*:-fork road-diagonal dry-flares countryside-farm crash-approach city-edge}; do
  for z in $(echo "$zooms" | tr ',' ' '); do specs="$specs test-results/l9b/specs-$tag/$s-z$z.json"; done
done
for tier in ${TIERS:-high low}; do
  SCENE_PORT=${SCENE_PORT:-3367} npm run scene -- $specs --backend ${BACKEND:-webgpu} --tier $tier --out test-results/l9b/$tag-$tier 2>&1 | grep -E '"pass"|"failed"|Error|error' | cut -c1-220
done
echo finished $tag
