# Paramedic hero
Reference studied: original, upscaled turnaround, emergency responders sheet.
Adult female, approximately 1.42 m; face/head including hair about 0.36 m.
Pale collared shirt, navy sleeves/insignia, auburn tousled high ponytail,
navy cargo trousers with two yellow calf stripes, dark gloves and chunky boots.
Red backpack and left-hand medical case; raised white six-point medical stars.
Rigid-part hierarchy and sockets as pipeline §7. All subdivision applied.
Meshes authored in world rest coordinates and parented preserving transforms.
No image textures, custom material tokens, or runtime subdivision modifiers.

## Final review
Three rounds: breadth/hand/ponytail refinement, single-piece insignia, reflective
cap normals, rear pockets, eye lashes. Final height 1.431 m. 58,098 triangles,
80 meshes; 19 required nodes with joint parenting and hand/backpack sockets.
Final hero and all four views compared again with turnaround. Purposeful details
retained; CPU render setup simplified. Left shoulder/elbow and right hip pose
check renders successfully, with carried bag following the left glove.
Three.js WebGPU and WebGL2 both load with zero errors or warnings.
