#!/bin/sh
set -eu
root=$PWD
side=${1:-main}
tag=${2:-p1-before}
source="$root/test-results/p1-danger/runtime-l7-$side"
mkdir -p "$source"
tar -xzf tools/qa/.p1-danger-sources/$side.tar.gz -C "$source"
cp tools/qa/r17-l7diff.ts "$source/tools/qa/"
cp tools/qa/accept/probe.ts "$source/tools/qa/accept/"
ln -s "$root/node_modules" "$source/node_modules"
cd "$source"
git init -q
git add -f src layouts public/assets/layouts
node --import tsx/esm tools/qa/r17-l7diff.ts "$tag" both 1
mkdir -p "$root/test-results/p1-danger/l7-$side"
cp test-results/r17-l7diff/"$tag"-* "$root/test-results/p1-danger/l7-$side/"
