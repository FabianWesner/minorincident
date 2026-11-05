# Final review / inf.brute

Four build-review rounds completed. Compared final hero, front, anatomical-right side, back and three-quarter views against reference-upscaled.png and original reference.png.

Matches: hulking construction-worker silhouette, oversized hanging arms, broad shoulders and neck, large open snarling mouth with teeth/tongue/nose/brows, swept volumetric dark hair, emissive red eyes, open safety vest and crossed reflective back tapes, dark short-sleeved torn shirt and cropped trousers, belt buckle, back pockets, red canvas sneakers with light toe caps/soles and crossed laces. Smooth facial remesh, sculpt rings and applied subdivision are exported as geometry.

Remaining visual differences: the reference's irregular abrasion, skin discoloration and cloth shredding are simplified; canonical pal_woodWarm produces a less saturated orange vest than the reference. Recorded in report.json.

Pose evidence: renders/pose-test.png uses the front-left camera to expose the left shoulder cap. armL rotates X -0.65 and Y -0.28 radians; foreArmL rotates Y -0.95; legR rotates Y +0.30. The upper-arm surface is hidden and stump_armL is restored to unit scale. Forearm, hand, shin and foot follow their respective parent joints. Seven stump caps export at zero rest scale with activation metadata.

Export inspection: 39,954 triangles, 65 material primitives (22 Blender meshes), all required infected nodes, no image textures, ten palette/emission materials, finite accessors and verified joint/stump parent relationships. Model height 2.204 m. WebGPU and forced WebGL2 capture runs reported no warnings, console errors or page errors. Hero: 1600 × 900, 96 Cycles samples. Review views/pose: 960 × 540, 24 samples.

Reproduce:

    python3 experiment/tools/blender_run.py ../assets/inf.brute assets/inf.brute/build.py -- --glb assets/inf.brute/model.glb --render assets/inf.brute/renders/hero.png --view ref --width 1600 --height 900 --samples 96

    python3 experiment/tools/blender_run.py ../assets/inf.brute assets/inf.brute/build.py -- --render assets/inf.brute/renders/pose-test.png --view far --pose --width 960 --height 540 --samples 24

    node experiment/tools/capture_glb.mjs /assets/inf.brute/model.glb assets/inf.brute/renders/three

Consecutive rebuilds match canonical material/position triangles at 1 micrometre precision. glTF accessor deduplication changes the container byte hash. Symmetric collapse-cost ties are broken by deterministic 10 micrometre offsets before budget reduction; unused UVs are omitted.
