# House A measurements and construction

Reference: broad one-storey ranch, pale greige horizontal lap siding, purple-gray shingle roof, ivory framing; rust door, amber divided-light windows. Porch is offset to the viewer's right. No lettering or invented markings are added.

Main shell 4.5 m deep × 6.4 m wide; foundation 0.47 m, wall eaves 3.12 m, ridge 4.38 m. Front faces +X. Porch 1.8 × 2.7 m, two steps, square capped columns, side/front balustrades. Main ridge runs along Y; cross-gabled porch ridge along X. All trim, muntins, curtain folds and door panels are solid geometry with at least 3 mm separation from the underlying visible surface.

Palette materials use only specified tokens. Roof and window/door/lamp groups preserve runtime visibility and articulation; remaining geometry joins by material within each group. Entrance hinge sits on the left jamb, lantern pivot at its mounting bracket. Warm window/lantern light anchors and non-rendering collider/socket empties export in extras. AO is deterministic 32-ray hemisphere visibility in the `ao` vertex color attribute, without textures. LOD1 and LOD2 are exported alongside LOD0.

The reference-facing porch is at positive Blender Y after the author's sketch coordinates are mirrored. The exported footprint is recentered on XY; the scene root remains at the origin. Structural wall depth uses signed offsets, so lap profiles remain outside the shell. Main-gable infill closes up to the actual roof plane, and the porch has a solid triangular infill behind its siding.
