# bld.house-e.w2

Base-owned variant of `bld.house-e`. Build with `npm run assets:build -- bld.house-e --decay w2`. The per-ID build.py delegates to the same shared recipe; it does not register another canonical runtime mesh.

Visual intent: large diagonal boards, broken glazing and porch belongings. The integrated roof, door and porch forms stay fully standing. No rubble or collapsed floors. Palette-separated `assets/bld.house-e/model.distance1.glb` / `model.distance2.glb` are explicit source recipes from the base's native primitives. Near damage tiers retain the window sash; far distance omits small sash/trim and replaces shrub crowns with closed octahedra. No triangle collapse/decimation.

Runtime outputs: `public/assets/models/bld.house-e.w2.glb`, `bld.house-e.w2.lod1.glb`, `bld.house-e.w2.lod2.glb`. Source exports belong to `assets/bld.house-e/model.w2*.glb`. Fixed physics and the original `col:house`, `door_front`, `entrySocket`, `front`, `roof` and `interior` transforms survive every tier. Material swatches fold into vertex colors per rigid owner; two materials, six asset draws. Doors remain separately owned.

Level interface: place with the exact base transform; use entrySocket for entrance/navigation placement and door_front for the hinge. Roof/interior are cutaway groups. Residential window lights are disabled on boarded/broken panes; the existing porch lamps remain independent. Level placement, light switching, smoke, AI and missions belong to runtime lanes.

Reference interpretation: preserve the existing base geometry; simplify tiny shingles, flowers and siding to meet the cap. House E's integrated base has no garage, so this variant retains its existing porch/gable form and does not invent a garage or enlarge its footprint. Evidence and measured results: `test-results/l3-oak-houses-de/bld.house-e.w2/` and the batch report.
