# Reference measurements and build decisions

Quadruped golden retriever, not a humanoid. Reference-upscaled and original crop checked against initial-drafts/infected-animals.png. Head including ears occupies approximately one third of total standing height. Target crown 1.18 m, shoulder 0.77 m, body nose-to-rump 1.6 m, shaggy raised tail extends another 0.7 m. Broad paws, floppy rounded ears, cream muzzle/chest, red leather collar with brass buckle and round ID tag, bright red eyes, open jaw and fangs. Coat has overlapping sculpted locks and darker matted clumps. Wounds on flank, legs, tail and face.

Both section 7 naming contracts are supplied: canonical infected arm/foreArm/hand nodes animate front legs; leg/shin/foot nodes animate hind legs. Quadruped body/neck/jaw/tail and legFL/FR/BL/BR, pawFL/FR/BL/BR aliases are nested into that hierarchy. Stump caps remain on proximal parents, with zero export scale and hidden metadata. No skinning, textures or unapplied subdivisions.

Review rounds: 1 blockout/detail, 2 reference refinement, 3 face/wound refinement, 4 fine shag and final contrast. Pose-test rotates armL, foreArmL and legR, removes the front-left limb and exposes stump_armL.

## Animal crowd budget update

Orchestrator override: LOD0 at most 12,000 triangles. The full coat is reduced to 44 chunky flank tufts, 20 neck-ruff tufts, 18 tail feathers, and purposeful head/leg feathering. Fine surface locks are removed. Applied subdivision is reduced to a low-segment game mesh, with extra detail reserved for the face. model.lod1.glb and model.lod2.glb share the LOD0 node hierarchy and pivots. Build asserts the LOD0 budget before export. Round 5 reviews the final animal-budget geometry.

Final LOD0 is 11,801 exported triangles. LOD1 is 1,892; LOD2 is 1,612. LOD2 removes small coat locks before reduction, retaining solid body volumes instead of fragmented fur. Mesh count in report.json is glTF mesh definitions; browser-checks.json separately records material primitive counts.
