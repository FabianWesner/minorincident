# Restroom block modeling notes

Reference: reference-upscaled.png. A 5.2 m wide, 3 m deep concrete shell, 3.5 m parapet, on a tiled 4.3 × 6.7 m plinth. Front faces +X; ground contact is Z=0. Blue men's door at -Y, burgundy women's door at +Y. Raised ivory international pictograms, lever locks, metal kick plates, six-sided warm lanterns, center park notice, slatted litter bin, louvers, rooftop fan cabinet and junction box. Flowering shrubs bracket the front corners.

The orchestrator's 15,000-triangle LOD0 cap overrides the generic Hero limit. Single-segment softened edges, selective concrete simplification and eight-face foliage reserve the budget for readable silhouettes. Static objects merge by palette within root/roof/interior; doors preserve hinge-parent nodes. Surface chips and lettering have physical depth with at least 6 mm clearance. Door meshes can rotate with their common hinge parents. Roof geometry, including HVAC, hides as one hierarchy. Interior is a basic divided shell rather than furnished restrooms.

No textures or brands. Deterministic seed 240. AO baked into active vertex colors. Main build exports the complete LOD chain from the same geometry, with 14% and 2.6% decimation targets (actual exported counts are recorded in geometry.json). Blender studio geometry is created only after export.

LOD2 merges equivalent concrete, trim and vegetation palette colors within the root/roof hierarchies, retaining all moving door/lamp groups. Collider and light extras remain present at every LOD.
