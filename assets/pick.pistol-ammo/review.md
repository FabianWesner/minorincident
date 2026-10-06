# Ground-pickup performance review

The performance override replaces the previous Side density target: LOD0 ≤2,500 triangles, ≤6 draw calls. Current export: 1,016 triangles, six primitives and four materials. LOD1/LOD2 regenerate on every GLB build at 508/250 triangles and six calls each. All 15 original node names exist in every LOD; four discontinued material-group nodes are empty transform anchors. Required root/front and lid/handle joint pivots remain present. No manifest registration performed.

Silhouette remains an open olive reinforced case with recessed hinged lid and a folding end handle. Three merged brass bundles and nine low-segment copper tips preserve ammunition colour separation. Tiny rims, screws, rivets and wear chips are omitted. This is an intentional ground-pickup representation rather than the earlier close-up 21-round model. Lower LODs lose panel and handle detail at distant viewing sizes.

Three.js study/game captures refreshed for LOD0 and game captures for LOD1/LOD2. Each LOD loads with six meshes, expected triangle counts, and no warnings/errors in WebGPU and WebGL2. Game captures inspected for shape readability and visible z-fighting. All exports are texture-free with baked AO. Hero and Blender game renders refreshed from the lighter script.
