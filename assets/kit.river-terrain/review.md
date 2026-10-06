# River terrain review

Three visual rounds reviewed against `reference-upscaled.png` and the supplied hero quality examples.

1. Blockout/export and browser study views: kit layout, broad rock proportions and palette established. Reduced geometry to obey the tighter 20k budget. Corrected the studio-world setup.
2. Reference and game views: widened folded leaves, added shrub crowns, exposed rock on bank sides, fixed ribbons to follow the wave height across their width, reduced distant LOD density.
3. Reference, final hero, browser study and game views: deeper teal water, larger spare reed clusters, larger bank tufts and moss cushions. Game framing widened to include all pieces. Removed collapsed underside triangles during export validation.

The tile, sloping bank, four distinct boulders, cattails and three reed clusters read clearly. Warm earth and lavender rocks reproduce the main reference color regions. Texture-like botanical detail is represented by broad palette-colored forms, consistent with the no-texture and no-per-leaf requirement. No brands or lettering are present. Foam has positive separation from the wave crests; no visible z-fighting in either renderer's captures. Static module geometry is merged by material, with reusable named parent nodes retained.

No animated parts, light anchors or movable-physics extras are applicable to this static terrain kit. Required building root is retained. Ambient occlusion is baked to vertex colors; GLBs have no image textures. Final structural results are recorded in `geometry-check.json`; browser results are recorded in `browser-check.jsonl`.
