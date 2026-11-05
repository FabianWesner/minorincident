# House B visual review

Three successful paired reference/game rounds: round2, round3, final hero/game. Initial attempt failed during mesh merging and produced no review render.

Final: 77,684 triangles, 32 material draws, ten palette/emission materials. Hero image is 1600×900 at 96 samples; game image is 960×540 at 24 samples. LOD1 and LOD2 GLBs are included. Static meshes merge within removable/animated assemblies; rotations/scales are applied before triangulation/export.

Reference silhouette retained: broad clay roof, porch-facing dormer, cream trim and rails, side entrance and steps, attached panelled garage, chimney, shuttered front glazing, raised flower beds and dense leafy shrubs. Palette-only geometry has no textures. Small applied parts have physical thickness/clearance. Door pivots, removable roof, floor interior, light anchors and collision extras are present. Actual vertex AO is baked at 32 samples.

Final Three.js study, rear and game views reviewed on WebGPU and WebGL2; both load with no console errors. Stationary game-camera frame pairs are byte-identical on both backends, with no observed flicker. The rear facade is inferred and the interior is unfurnished.
