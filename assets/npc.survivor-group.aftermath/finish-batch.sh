#!/bin/sh
# Rebuild the shared stock before extracting and delivering its members.
set -eu
npm run assets:build -- npc.survivor-group.aftermath
for member in dale sam cap-woman bun-woman; do
  npm run assets:build -- npc.survivor-group.aftermath.$member
  npm run assets:pack -- npc.survivor-group.aftermath.$member
  npm run assets:validate -- --ids npc.survivor-group.aftermath.$member
done
for id in npc.civilian-elderly.aftermath npc.paramedic.aftermath npc.civilian-woman-a.aftermath npc.survivor-group.aftermath; do
  npm run assets:pack -- "$id"
  npm run assets:validate -- --ids "$id"
done
