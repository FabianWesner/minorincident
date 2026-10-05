# R3 final visual and contract review

Compared final hero and the front/side/back/three-quarter sheet with reference-upscaled.png after three review passes in this revision. The enlarged head and face, broad claw hands, chunky shoes, forward hunch, bent knees, raised/reaching arms, emissive red eyes, open toothy mouth, grey-pink skin, mouth blood, thick uneven brown hair and torn/bloody workwear address the prior orchestration review. The side view proves the lurch; the front view proves the head/hand proportions and face readability. Fine fabric wear and diffuse blood staining remain simplified.

The GLB contains every required infected node. Parent chains for forearms/hands and shins/feet are correct. All rigid joint scales are one and rotations are baked into the mesh geometry. Machine checks confirm that the head sits forward of the hip, wrists reach well forward of the shoulders and above the hips, knees are forward of the hips/ankles, and soles contact z=0. All geometry attributes are finite. There are no textures or skins. Seven separate stump caps retain their exact names and hidden metadata.

Pose-test.png shows armL and foreArmL rotated, legR lifted, and stump_armL exposed with the detached arm moved away for visibility. The exported GLB stays in the lurching rest pose.

Deliverables: model.glb, build.py, hero.png (1600×900, 96 samples), turnaround.png, pose-test.png, final Three.js captures and report.json. Front/side/back/three-quarter and pose reviews are 960×540 at 24 samples. WebGPU and WebGL2 both report 39,738 triangles / 63 meshes with zero console errors or warnings. The helper's study camera crops extremities; gameplay captures include the complete character.

A second build preserves exact joint transforms and mesh geometry within 9.1e-8 m. GLB byte packing differs, which is reported as a remaining export limitation. Source simplification removed the unnecessary transform-apply calls from the proportion pass because the rest-pose bake already applies those transforms. No references, specs, other assets, or shared development tools were edited.
