# Visual review

## Round 1 — 960 × 540, 24 samples

Reference view: complete three-bay silhouette, detailed furnishings and corridor are
readable. Found reversed shop order and mirrored glyphs: correct the authored Y
layout and text frame. Too much pale masonry above signs; use wood upper wall.
Sign blue too light: use denimBlue palette. Oven fire occluded by the display:
raise hearth in the finishing pass. 157,800 triangles / 32 draws: reduce small
bevels and curved glyph resolution, keep major housing and pilaster bevels.

## Round 2 — 960 × 540, 24 samples

81,448 triangles / 33 draws. Text and bay order corrected; darker signs and wood
upper wall match the source more closely. Full object readable in ref view;
game framing clips the upper-right cap. Larger sign type, a second washer row,
transparent display cap, a raised firebox and a wider game frame are the final
refinements. Source-facing ref camera corrected to the +Y side. Floor corners
are chamfered with clipped corner pavers. Final exports/browser checks pending.


## Round 3 — 960 × 540, 24 samples

Upper washer row, readable larger signs, clear display-case lid, exposed oven
fire, clipped/chamfered floor corners and full game framing. Source bays and
purposeful furnishings read at play scale. Browser study and game views loaded
in WebGPU and WebGL2 with no warnings or errors.

## Round 4 — 1600 × 900, 96 samples

Golden fire emission and final studio lighting/framing approved. Initial LOD2
retained too much microgeometry; connected small parts and thin wires are
removed before distance decimation. Broad sign boards and foundation are
protected.

## Round 5 — final geometry cleanup

Thin cylinder bevels now use at most 24% of the smallest dimension. The GLB
audit confirms zero degenerate triangles in all three models, unit scales,
no textures, vertex AO and all named joints/root/interior/roof/colliders.
Both browser backends load the Hero without console warnings/errors. Repeated
game captures are pixel-identical (zero changed pixels); no visible flicker.
Final LOD measurements and backend checks are recorded in glb-audit.json and
browser-lod1.jsonl/browser-lod2.jsonl. No further visual refinement rounds.

Final source export: LOD1 14,540 triangles (16.9%), LOD2 4,068 (4.7%).
Both retain 39 material draws and zero degenerate triangles. These exceed
the approximate density targets; retained per pragmatic finish instruction.
