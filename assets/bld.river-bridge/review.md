# Production review — approved, integration dimension note

Five rounds reviewed against reference-upscaled.png and the police-car round-1 quality benchmark. Final delivery: soft-beveled concrete span with end abutments and center pier, two road lanes, yellow dashed centerline/shoulder stripes, white approach bars, paired guardrails, end hazard plates, four separately pivoted lantern heads, water/foam and rocky planted banks. Palette colors and road/rail silhouette remain clear in game captures.

- Final hero: 1600 × 900, Cycles CPU, 96 samples. Game: 960 × 540, 24 samples. Complete model in frame; no clipped lamps.
- GLB validation: 32,898 / 4,468 / 1,180 triangles; 17 / 17 / 16 draw calls. LOD1 13.6%, LOD2 3.6%. No textures. Baked AO/color tint exported as COLOR_0. Scalar Principled palette materials, emission on lanterns.
- Required root and +X front marker, light anchors, collider empties and joint pivots verified in all three exports. Mesh rotations/scales applied. Every emitting lantern is linked to its ss_light anchor.
- WebGPU and WebGL2 study/game captures: no console warnings or errors, including LOD1 and LOD2. Both simplified models retain the bridge silhouette.
- Paint clears asphalt by >= 5 mm; layered approach bars clear other road paint by >= 5 mm. Hazard diagonals stand 8 mm off their plates. Foam clears the sampled river; earth patches reject mutual overlaps.
- Three nearby game camera azimuths (44.8°, 45°, 45.2°) reviewed. Repeat 45° frames are pixel-identical on both backends. No visible flicker.
- Final river polish smooths normals and uses roughness 0.45, removing excessively faceted browser reflections.
- Source reviewed for simplicity: shared shape helpers, one material/parent merge pass, rebuilt LOD2 geometry, one secondary simplification pass for LOD1. Preview tint nodes stay in staging; production materials retain simple scalar inputs.

Integration note: the reference includes the full river/bank diorama. Its modeled Y-up bounds are 16.09 × 6.23 × 12.30 m; the registry still has provisional 8 × 5 × 6 m dimensions. Only this asset directory was changed.
