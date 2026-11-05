# Bridge proportions and parts
Reference: single road module with the river running perpendicular, two end supports and a central pier; four gooseneck lanterns; paired metal guardrails with four concrete uprights per side. Two lanes, dashed yellow centerline and continuous yellow edges. Concrete courses, expansion joints, black/yellow end hazard plates, rocky grassy river banks and stylized water foam.

Metres: diorama 16 × 12; road 13 × 5.7; bridge deck top 3.18; rail top 4.12; lantern suspension about 6.13. +X road direction; Z-up; earth bottom z=0. Texture-free palette materials. Main static parts merge by material. Lantern pivots at top joints, emissive meshes linked by ss_light anchors. LODs rebuild reduced bevels, rail segments, water grids and vegetation clusters.

## Refinement
1. Blockout: checked road/river silhouette; 53,056 triangles exceeded the orchestrator cap. The far lantern was cropped in the game frame.
2. Reduced plant cluster resolution and bevel segments; 31,098 triangles / 17 draws. Added asphalt seams, concrete runoff/moss and flowers; corrected rail-clamp orientation.
3. Added palette-preserving pavement vertex tint, larger bank boulders, richer flowers and bare earth. Raised foam away from the sampled river surface. 32,942 triangles / 17 draws. Widened the game frame.
4. Final spacing cleanup: earth patches reject overlaps; approach paint clears centerline/shoulder paint by >= 5 mm. LOD2 uses fewer rail supports and retains simplified lantern silhouettes. Geometry joins by material within each lamp pivot group. AO is baked at 32 samples and multiplied by the authored tint.

The complete reference diorama is 16 × 12 m, rather than the registry's provisional 8 × 6 m footprint. No registry or integration files were changed in this asset-only job. The river uses the existing backpackTeal palette identity with a bluer water-specific starting value. Organic vegetation and foam are deliberately broad and stylized, without per-leaf geometry.
5. Three.js exposed specular facets on the river that were subdued in the Blender studio. Smoothed the continuous river normals and raised roughness to 0.45. Corrected exported palette factors by restricting vertex tint shader nodes to Blender preview staging; GLB materials use scalar Principled colors and exported COLOR_0 carries baked AO and tint.

Final LOD geometry: 32,898 / 4,468 / 1,180 triangles (100% / 13.6% / 3.6%), 17 / 17 / 16 draws. Fifth pass changes water normals/material only.
