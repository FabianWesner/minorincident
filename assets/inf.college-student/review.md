# Hero review

Five bounded rounds: initial build; cloth/contact and topology refinement; swept hair and limb transition refinement; continuous facial sculpt; final sleeve blood contact correction.

Compared final front, side, back and three-quarter renders against reference-upscaled.png. Adult outfit, chibi scale, purple open cardigan, ivory bloodied tee, cuffed jeans, red trainers, pigtails, red eyes and brown cat-patch backpack are represented. Fine strands, anatomy and cloth folds remain more geometric and less nuanced than the painted reference; this is the remaining artistic gap.

Rigid animation proof: pose-test.png rotates armL, foreArmL and legR; the left arm is offset from its shoulder to reveal stump_armL at the torso pivot. All seven caps remain with proximal parents. They export at zero scale with hidden/stumpFor/showScale extras, so gameplay must restore showScale when showing them.

Final hero: 1600 × 900, Cycles 96 samples. Turnaround: four 960 × 540 views in a 1920 × 1080 sheet. Pose: 960 × 540, 24 samples. GLB has no image textures or skinning; all modifiers are applied. Exported hierarchy, palette naming and zero-scale caps checked in validation.json. Three.js WebGPU and WebGL2 captures and clean console results are in renders/ and three-check.jsonl.

The asset is delivered for review; this job does not modify the runtime registry or the source specifications. No application tests are needed for this isolated geometry-only change.
