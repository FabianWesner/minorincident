#!/bin/sh
# world-fill (PO #34) captures: tools/qa/world-fill-capture.sh <tag> [scene-name-glob]
# Writes test-results/world-fill/<tag>/<scene>-z<zoom>{-webgpu}{-low}/shot-*.png for zoom 1 and 1.5, WebGPU high + low,
# plus one WebGL2 high zoom-1 row. One Scene Lab browser at a time (E2E_UNITS=1); SCENE_PORT must be unique per lane.
tag=$1; glob=${2:-world-fill-*}
specs=test-results/world-fill/specs
python3 tools/qa/world-fill-gen.py $specs 1,1.5 >/dev/null
all=$(ls $specs/$glob.json)
z1=$(ls $specs/$glob-z1.0.json)
run() { E2E_UNITS=1 SCENE_PORT=${SCENE_PORT:-3802} npm run scene -- "$@" --out test-results/world-fill/$tag 2>&1 | grep -E '"pass"|"failed"|"drawCalls"|"triangles"|Error|error' | cut -c1-200; }
run $all --backend webgpu --tier high
run $all --backend webgpu --tier low
[ -z "$NO_WEBGL2" ] && run $z1 --backend webgl2 --tier high
echo finished $tag
