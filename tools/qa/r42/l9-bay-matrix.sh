#!/bin/sh
# r42-l9pin: before/after matrix for tools/qa/r42/l9-bay-probe.ts. Usage: sh tools/qa/r42/l9-bay-matrix.sh <out.jsonl> [seeds]
# Cases: marker-hud / marker-w = HUD driver from the level start (W to the marker, Space taps with boarders / W only; the production
# bot only defends the rail-stall hatch); intended = production bot on the road route to x 420, then the HUD driver (no hatch
# shooting at the bay); west-edge = the APC set where r41 was pinned (443.1, 6.3, yaw 0, gate shut) when it reaches x 400;
# pile50 = 50 extra infected piled on the APC at that pose right after the evacuation.
out=$1; seeds=${2:-"1 2 3 4 5"}
: > "$out"
p=tools/qa/r42/l9-bay-probe.ts
for s in $seeds; do
  node --import tsx/esm $p --seed "$s" --mode hud --switch-x -1000 --max 480 | tail -1 | sed 's/^{/{"case":"marker-hud",/' >> "$out" &
  node --import tsx/esm $p --seed "$s" --mode w --switch-x -1000 --max 480 | tail -1 | sed 's/^{/{"case":"marker-w",/' >> "$out" &
  node --import tsx/esm $p --seed "$s" --mode hud --switch-x 420 --max 480 | tail -1 | sed 's/^{/{"case":"intended",/' >> "$out" &
  wait
  node --import tsx/esm $p --seed "$s" --mode hud --at 443.0949,6.2527,0 --gate-closed --early --max 480 | tail -1 | sed 's/^{/{"case":"west-edge",/' >> "$out" &
  node --import tsx/esm $p --seed "$s" --mode hud --pile 50 --at 443.0949,6.2527,0 --gate-closed --max 480 | tail -1 | sed 's/^{/{"case":"pile50",/' >> "$out" &
  wait
done
