# R2 final review

Compared the final hero and turnaround against reference-upscaled.png and the accepted assets/inf.common-worker/renders/hero.png. The first five modeling rounds are followed by two R2 modeling passes (review, then final), for seven total rounds. renders/r1-hero.png preserves the prior upright proportions for comparison.

- Proportions: PASS. Exported crown-to-neck height is 36.86% of the 1.531 m posed height. The head is wider, the glowing red eyes are larger, and the open toothed snarl remains readable under the hair.
- Lunge: PASS. Torso leans 27.5°, both knees bend deeply (76.24° / 68.17°), and the feet are staggered and grounded. Arms reach forward with large splayed, hooked, bloody fingers.
- Chunky silhouette: PASS. Hands are 48% larger; sleeves, forearms, thighs, calves and coral/cream sneakers are thicker. Auburn hair has broad shoulder-length volumes, full rolled shoulder curls, flyaways, a half ponytail and pink tie. The brown crossbody shoulder bag remains on the left hip.
- Identity: PASS. Pink buttoned cardigan, pointed white collar, rolled sleeves, watch, torn jeans and coral/cream shoes retain the reference's colors and accessories.
- Surfaces: PASS. All smoothing modifiers are applied, surfaces use smooth shading and scalar Principled materials, and no image textures are present. Blood and detail surfaces move with their shells, preserving their offsets during reshaping.
- Rig: PASS. All infected nodes and caps retain their required names and hierarchy. Joints are positioned at the new shoulders, elbows, wrists, hips, knees and ankles. Caps have zero rest scale and parent-side ownership. The pose render rotates armL, foreArmL and legR, separates the shoulder to show stump_armL, and lifts the articulated leg.
- Export: PASS. 38,826 triangles including hidden caps, 65 material-batched meshes. Independent GLB audit confirms finite geometry, grounded soles, knee angles, head ratio, named nodes and cap state.
- Runtime: PASS. Refreshed WebGPU and forced WebGL2 captures report no console errors or warnings and matching 38,826 triangle counts. The game-camera captures show the whole lunging character.

Remaining visual tradeoff: fine curl strands and cloth fraying are simpler than the reference.

Source cleanup: existing rigid-part helper patterns are reused. Four small mesh/joint helpers apply the proportion correction consistently to clothing, features, blood and pivots. No changes to references, shared tools or specs.

Rebuild all final outputs:

```sh
python3 experiment/tools/blender_run.py ../assets/inf.suburban-mom assets/inf.suburban-mom/build.py -- --render assets/inf.suburban-mom/renders/hero.png --view final --samples 96 --width 1600 --height 900 --glb assets/inf.suburban-mom/model.glb
node experiment/tools/capture_glb.mjs /assets/inf.suburban-mom/model.glb assets/inf.suburban-mom/renders/three
python3 assets/inf.suburban-mom/audit.py
```
