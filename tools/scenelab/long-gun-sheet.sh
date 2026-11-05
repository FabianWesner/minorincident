#!/bin/sh
# Contact sheet per qa-long-gun scene: sh tools/scenelab/long-gun-sheet.sh <out-dir> [gun...]
out=$1; shift
mkdir -p "$out"
for g in "$@"; do
  montage test-results/scenes/qa-long-gun-$g/shot-*.png -tile 4x -geometry 400x225+2+2 -font /System/Library/Fonts/Helvetica.ttc -pointsize 14 -label '%t' "$out/$g.jpg"
done
