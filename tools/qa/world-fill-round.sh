#!/bin/sh
# world-fill round: capture <tag> for <glob>, reuse <prev> captures for scenes not re-run, sheet vs before, gate summary.
# usage: tools/qa/world-fill-round.sh <tag> <glob> [prev-tag]
tag=$1; glob=$2; prev=$3
root=test-results/world-fill
NO_WEBGL2=${NO_WEBGL2-1} sh tools/qa/world-fill-capture.sh $tag "$glob"
if [ -n "$prev" ]; then
  for d in $root/$prev/world-fill-*; do [ -e "$root/$tag/$(basename $d)" ] || cp -r "$d" "$root/$tag/"; done
fi
python3 tools/qa/world-fill-sheet.py $root/sheet-$tag.jpg $root/before $root/$tag
python3 tools/qa/world-fill-metrics.py $root/$tag | grep -v "pass=True"
echo end
