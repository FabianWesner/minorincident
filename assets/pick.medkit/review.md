# Medkit performance review

Performance revision: LOD0 is 2,104 triangles and six draw calls, under the orchestrator budget of 2,500 triangles / six draws. LOD1 and LOD2 regenerated from the new base: 1,362 and 836 triangles. Gentler reduction ratios (.65/.40) preserve the thin corner guards.

The existing silhouette, raised white cross, red shell, dark seam and orange grip are retained. Single-segment bevels and eight-sided dark pins replace denser detail. All 12 original node names remain in all three files; the former metal material node is an empty anchor. Joint pivots, physics/collider extras and AO remain.

All LODs audited: no degenerate triangles, finite coordinates, no textures, AO exported, six draws. All three LODs’ WebGPU and WebGL2 captures pass without warnings or errors. Hero (1600×900, 96 samples) and game (960×540, 24 samples) refreshed and visually reviewed. Cross clear in game view; no visible z-fighting. Reference scuffs remain omitted. Manifest untouched.
