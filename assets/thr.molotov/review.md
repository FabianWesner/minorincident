# Visual review — production pass

Three modeling/render-review rounds completed. Round 1 established the bottle, raised label, wick, and separate flame. Round 2 corrected olive/brass colors, reference tilt, and trailing flame length. Round 3 reduced the flame's lit surface response so its orange/gold bands stay saturated in Blender and Three.js.

Reference silhouette and principal markings preserved: broad bottle, long neck, double collar, rectangular cream label with flame pictogram and small print bars, folded wick and side-trailing fire. No real brands. Static geometry merged by material; flame origin at the mouth. Geometry is texture-free and deterministic.

Final game views inspected on WebGPU and WebGL2: readable bottle/wick/fire silhouette; no visible label/border/emblem z-fighting. Both backends report 9 meshes/primitives, 3,260 triangles, no errors or warnings. GLB positions are finite and all exported triangles have nonzero area. The close study camera supplied by the shared viewer crops this tall object vertically; the supplied game captures and Blender hero show the complete asset.

Budgets: weapon 3,260 <= 6,000 triangles; 9 <= 30 draw calls. Required throwable grip exists. No unresolved model gaps.
