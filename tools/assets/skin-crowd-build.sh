#!/bin/sh
# skinned-crowd prototype assets: suit worker (lane/batch15 TRELLIS rigid LODs, welded) and civilian-woman-a
# (wave2 pre-binding watertight bodies + the wave2 rigid LODs for joints/ownership).
#   sh tools/assets/skin-crowd-build.sh <work dir with the inputs>
# Inputs in <work>: suit.lod{0,1,2}.glb + suit.atlas.webp + suit.atlas.low.webp + inf.common-worker.atlas.webp
#   (git show lane/batch15:assets/inf.common-worker/model*.glb, public/assets/models/inf.common-worker.atlas*.webp),
#   woman.lod{0,1,2}.glb + flat-lod{0,1,2}.glb (minorincident_3dpipeline/cast/wave2/npc.civilian-woman-a{,/source}).
set -e
W=${1:?work dir}
OUT=public/assets/models/skinned
mkdir -p "$OUT" docs/reports/skinned-crowd/assets
run() { npx tsx tools/assets/skin-crowd-figure.ts "$@"; }
for L in 0 1 2; do
  run --rig "$W/suit.lod$L.glb" --texture "$W/suit.atlas.webp" --out "$OUT/inf.common-worker.lod$L.glb" --report "docs/reports/skinned-crowd/assets/inf.common-worker.lod$L.json" >/dev/null
  run --rig "$W/suit.lod$L.glb" --texture "$W/suit.atlas.low.webp" --texture-max 512 --out "$OUT/inf.common-worker.lod$L.low.glb" >/dev/null
done
# Recorded wave2 placement (rig.json: uniform_scale / rotation_y_degrees per LOD).
set -- 2.0646940390249777 2.058812228327142 2.073771131960094
for L in 0 1 2; do
  S=$1; shift
  run --rig "$W/woman.lod$L.glb" --body "$W/flat-lod$L.glb" --body-scale "$S" --body-rot-y 135 --out "$OUT/npc.civilian-woman-a.lod$L.glb" --report "docs/reports/skinned-crowd/assets/npc.civilian-woman-a.lod$L.json" >/dev/null
  run --rig "$W/woman.lod$L.glb" --body "$W/flat-lod$L.glb" --body-scale "$S" --body-rot-y 135 --texture-max 512 --out "$OUT/npc.civilian-woman-a.lod$L.low.glb" >/dev/null
done
ls -la "$OUT"
