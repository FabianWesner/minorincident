# bld.mainstreet-brick.w3

Base-owned L3 Commerce Street damage sibling of `bld.mainstreet-brick`. Runtime loads
`loadAsset('bld.mainstreet-brick', 'high' | 'lod1' | 'lod2', 'w3')`; this ID has a source
wrapper and QA directory, with no conflicting canonical manifest mesh.

The integrated source's wall, cornice, awning, roof and door recipes are reused
before material batching. Three explicit distance recipes omit named fittings,
reduce cylinders and fuse pavement seams. No decimation and no AABB scaling.
The door/collider anchors provide the translation into the integrated base's
coordinate system. Root, roof, interior, door pivots, collider records and other
semantic empty transforms are copied exactly from the base export.

W3: dark jagged shop openings, local soot strips and damaged trim; no wall/roof collapse or rubble.

Static materials are batched under their visibility/door owners. The broken
power supply is baked as nonemissive glazing/signage; existing light empties
survive without emitting records. The asset emits no light. Fixed building
physics is nonpushable and nonkickable. District placement, power switching,
fire/smoke, navigation and door interactions belong to the runtime lane.

Interface anchors: `root`, `roof`, `interior`, every original `door_*` and
`col:*` node, plus +X `front`. Keep roof/interior visibility and door rotations
on those owners. See `test-results/l3-commerce-shop-damage/bld.mainstreet-brick.w3/` for reference,
all-side turntable, matching LOD views, game-size view and footprint comparison.
