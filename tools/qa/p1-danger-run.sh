#!/bin/sh
set -eu
side=$1
root=$PWD
out="$root/test-results/p1-danger/$side"
mkdir -p "$out"
if [ "$side" = final ] || [ "$side" = candidate ] || [ "$side" = restored ] || [ "$side" = stable ]; then
  source="$root"
else
  source="$root/test-results/p1-danger/runtime-$side"
  mkdir -p "$source"
  tar -xzf "tools/qa/.p1-danger-sources/$side.tar.gz" -C "$source"
  cp tools/qa/p1-danger-routes.ts tools/qa/p1-danger-ttk.ts "$source/tools/qa/"
  ln -sfn "$root/node_modules" "$source/node_modules"
fi
cd "$source"
P1_DANGER_SIDE="$side" P1_DANGER_OUT="$out/ttk.json" node --import tsx/esm tools/qa/p1-danger-ttk.ts
P1_DANGER_SIDE="$side" P1_DANGER_LEVELS=L1,L2,L3,L4,L5 P1_DANGER_OUT="$out/routes-early.json" node --import tsx/esm tools/qa/p1-danger-routes.ts &
early=$!
P1_DANGER_SIDE="$side" P1_DANGER_LEVELS=L6,L7,L8,L9,L10 P1_DANGER_OUT="$out/routes-late.json" node --import tsx/esm tools/qa/p1-danger-routes.ts &
late=$!
a=0; b=0
wait "$early" || a=$?
wait "$late" || b=$?
test "$a" -eq 0 && test "$b" -eq 0
