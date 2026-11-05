# Final review — civilian woman A

Five review rounds completed. Final reference comparison used hero.png and turnaround.png alongside reference-upscaled.png and the original crop. The core identity is preserved: coral floral sundress, ivory open cardigan, chestnut half-up bun, tan botanical tote and red sneakers. Forms use applied subdivision, smooth shading and soft bevels. Flowers, seams, facial features and botanical motifs are dimensional geometry; no image textures.

Technical checks pass: 56,966 triangles; 35 merged rigid-part/material meshes; all 19 required nodes; correct hierarchy and unit joint scales; grounded feet; height 1.414 m; no skinning or textures. Pose-test.png and pose-test.json demonstrate armL, foreArmL and legR rotations moving their descendants. The rest-pose GLB is exported before posing.

Hero: 1600×900, 96 Cycles samples. Four review views: 960×540, 24 samples. Turnaround: 1680×540. Pose: 960×540, 24 samples. Final WebGPU and WebGL2 captures have matching asset statistics and no warnings/errors in the shared capture logs. Additional full-body framed captures compensate for the generic viewer's close study camera cropping tall characters.

Art gap / needs-human: the face and loose curls are more simplified than the illustrated reference; the outfit silhouette and signature accessories read clearly, but exact facial likeness is not achieved. The flat pal_* reference color extensions also require registration in the global palette outside this asset-only job scope. No reference files or shared project code were changed.

Rebuild all deliverables through the required wrapper:

```sh
python3 experiment/tools/blender_run.py ../assets/npc.civilian-woman-a assets/npc.civilian-woman-a/build.py -- --render assets/npc.civilian-woman-a/renders/hero.png --view final-set --samples 24 --width 960 --height 540 --glb assets/npc.civilian-woman-a/model.glb
node experiment/tools/capture_glb.mjs /assets/npc.civilian-woman-a/model.glb assets/npc.civilian-woman-a/renders/three
node assets/npc.civilian-woman-a/capture-framed.mjs
```
