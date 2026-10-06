# veh.sedan-green production review

Passed after four visual rounds. The green four-door three-box silhouette, warm rectangular lamps, thin chrome/rubber trim, dark tinted cabin glazing, eight-pocket steel wheels, and aged edge paint match the reference at the manifest scale. Soft crowned roof and bevelled bodywork remain clear from the game camera. No real brand names or textures are present.

All four door hinges and wheel axle centres retain separate named motion nodes. Head and brake lamps have separate assemblies, light anchors, and emissive mesh references. Driver/exit sockets and the chassis collider/physics extras are exported. Static geometry is joined by material. All painted chips, bright strips and badges are physically offset; the game captures show clean edges without z-fighting patterns.

LOD0: 70,127 triangles, 39 draw calls, 5,125,280 bytes. LOD1: 8,814 triangles (12.6%). LOD2: 1,745 triangles (2.5%). Small panes survive decimation; all LOD bounds remain inside the production frame. Corner AO is baked deterministically at 32 samples and exported as COLOR_0. A second build produced a byte-identical main GLB.

Final hero: 1600 × 900, 96 samples. Final Blender game view: 960 × 540, 24 samples. Three.js study and game captures passed on WebGPU and WebGL2 with zero console errors or warnings, each reporting 70,127 triangles / 39 meshes / 4.4 × 1.9 × 1.8 glTF metres. Both backend game images and the front/rear study images were visually reviewed.

Source simplification: fitting transforms are baked directly into vertex coordinates, avoiding matrix shear; each LOD uses one copied mesh set, applies collapse once, clamps the bounds, exports, then restores the original meshes. No outstanding gaps.
