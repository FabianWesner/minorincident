#!/bin/sh
set -eu
root=$PWD
side=$1
source="$root/test-results/p1-danger/runtime-matched-$side"
out="$root/test-results/p1-danger/$side-matched"
mkdir -p "$source" "$out"
tar -xzf "tools/qa/.p1-danger-sources/$side.tar.gz" -C "$source"
# Equal decision/navigation code for the unchanged early campaign maps.
# Late campaign geometry/policies changed substantially and stay separately labelled.
cp src/debug/bot/LevelOneBot.ts src/debug/bot/LevelTwoBot.ts src/debug/bot/LevelThreeBot.ts src/debug/bot/LevelFourBot.ts src/debug/bot/LevelFiveBot.ts src/debug/bot/LevelSixBot.ts src/debug/bot/Walker.ts src/debug/bot/helpers.ts "$source/src/debug/bot/"
cp tools/qa/p1-danger-routes.ts "$source/tools/qa/"
ln -sfn "$root/node_modules" "$source/node_modules"
cd "$source"
sha256sum src/debug/bot/LevelOneBot.ts src/debug/bot/LevelTwoBot.ts src/debug/bot/LevelThreeBot.ts src/debug/bot/LevelFourBot.ts src/debug/bot/LevelFiveBot.ts src/debug/bot/LevelSixBot.ts src/debug/bot/Walker.ts src/debug/bot/helpers.ts > "$out/policy-sha256.txt"
P1_DANGER_SIDE="$side-matched" P1_DANGER_LEVELS=L4,L6 P1_DANGER_OUT="$out/routes-matched.json" node --import tsx/esm tools/qa/p1-danger-routes.ts
