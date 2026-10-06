# kit.bleachers production review

Passed: five seating rows; split aluminium plank surfaces and separate footboards; visible support saddles, three support bents, diagonal braces, broad feet, sloping side rails and rear guard bars. Front is +X, ground contact is z=0, units are metres. No brands or markings in the reference. Materials use palette tokens with scalar metallic/roughness settings, no textures. AO is baked into vertex colors. Static pieces join into four meshes beneath the required building root. No parts animate and no light or movable-physics anchors are applicable.

Three geometry/review rounds: initial detailed blockout; single-segment bevel simplification and framing correction; raised central seat retaining plates and final studio presentation. A final game-camera framing correction follows these rounds. Source simplified to boxes, oriented beams and octagonal fasteners with material buckets; no per-wire mesh generation or speculative abstractions.

LOD0: 9,388 triangles / 4 calls. LOD1: 5,162 / 4. LOD2: 2,814 / 4. Both lower-detail exports regenerate from build.py using temporary modifier application. Required root retained in every export.

Final GLB study and game captures pass WebGPU and WebGL2 without console errors. Every LOD loads on both backends. Game-camera screenshots taken 60 frames apart have zero changed pixels on both backends. Retaining plates and bolt faces stand clear of supporting geometry; plank seams are actual gaps. No observed flicker.

The reference appears to show six broad seating planks; the asset intentionally follows the explicit five-row brief. Warm highlights are supplied by lighting rather than orange paint. No outstanding production gaps.
