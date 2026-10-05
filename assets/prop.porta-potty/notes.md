# Production porta-potty

Reference proportions: enclosure approximately 1.2 m square, 2.45 m total height; base 0.18 m, wall shoulders 2.14 m. +X is front, +Z up, pallet feet touch z=0. The peach barrel roof has three transverse raised ribs. The enclosure has molded panel islands, deep seams, tall corner posts, a rounded door, bronze hinges and screws, a recessed pull handle, and a raised two-person restroom plaque. No brands or invented text are added.

Palette start values are tuned to the supplied cobalt/peach/terracotta reference while retaining known token names. Roof and sign use pal_picketWhite; blue shell uses pal_policeBlue. No textures or lighting anchors are needed. Cycles bakes deterministic 32-sample ambient occlusion into the ao vertex colour attribute. The root has heavy-prop physics extras and a cuboid collider.

The door empty retains its vertical hinge at (0.64,-0.465,0); its geometry is joined by material under that pivot. Fixed meshes are joined by material under root. The blue fixed mesh is named body. The frame remains open behind the door, with a basic tank, open seat rim and vent stack inside.

Surface separation: door center field is 6.5 mm above the door skin; sign backing is 10 mm above the center field; pictogram heads and torso are at least 4.5 mm above the sign. Raised roof ribs have a 15 mm minimum top separation at their endpoints. Screws, side-panel beds/islands and handle have physical depth. Pictogram strokes intersect the sign backing but their visible crowns project 16.5 mm; no exposed faces coincide.

Review rounds: 1 established the reference construction but exceeded the triangle budget. Round 2 reduced bevels and fastener segments, fixed the open doorway, merged palette variants and baked AO. Round 3 replaced lathed screw cylinders with closed primitives and removed unused material options. Static draws and animated material groups together remain below the cap.

Round 4 removes 44 zero-area triangles produced by bevel/boolean intersections. GLB validation reports zero degenerates and no textures. Canonical triangle-position hashes at micrometre precision match on independent rebuilds; exporter vertex ordering can differ.
