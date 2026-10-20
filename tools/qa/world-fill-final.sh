#!/bin/sh
# world-fill final evidence: night-read (E31-AC16) catalog, world-fill catalog gates, then the full capture with the WebGL2 row.
# usage: tools/qa/world-fill-final.sh <tag>
tag=$1; root=test-results/world-fill
E2E_UNITS=1 SCENE_PORT=${SCENE_PORT:-3802} npm run scene:catalog -- --filter 'night-read-*' --backend webgpu --jobs 1 --out $root/nr-$tag 2>&1 | tail -2
grep -oE "^\| night-read[^|]*\| [a-z]+ |navContrastMin [0-9.]+/2.5" $root/nr-$tag/index.md
E2E_UNITS=1 SCENE_PORT=${SCENE_PORT:-3802} npm run scene:catalog -- --filter 'world-fill-*' --backend webgpu --jobs 1 --tier low --out $root/cat-$tag 2>&1 | tail -2
NO_WEBGL2= sh tools/qa/world-fill-round.sh $tag 'world-fill-*'
