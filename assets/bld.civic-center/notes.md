# Sunset Grove Civic Center

Reference proportions: broad 12 m facade, 9 m deep gym hall, 6.3 m parapet, 7.3 m clock pediment. The raised civic-center lettering uses Sunset Grove per R2. Warm brick masonry, cream stone pilasters, slate roof, bright blue safe-zone banners, warm glazing, staggered four-course sandbags, roof access tower and three detailed HVAC units reproduce the reference silhouette and part hierarchy.

Coordinates are metres, +X front, Z up, tiled base contacts Z=0. The roof is grouped under `roof`, floor under `interior`; `door_L` and `door_R` have hinge origins. Four separately named lantern assemblies have `light:*` extras. Non-moving meshes join by material within the required visibility groups. Lettering and banner icons are relief meshes; sign text, glazing trim, banner edges, and roof seams have explicit depth separation above 3 mm.

LOD1 and LOD2 use deterministic mesh collapse from the joined LOD0 meshes. No image textures, third-party geometry, or additional dependencies.

A deterministic 32-ray short-range AO bake is stored in the active `ao` vertex colour attribute and exported as glTF vertex colours. Meshes are constructed directly to keep rebuild cost low. Lantern assembly origins sit at their mounting joints. Collider empties represent the static exterior walls without filling the entrance opening.
