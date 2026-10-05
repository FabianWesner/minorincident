# Bloated hero review

Final comparison: original crop, upscaled four-view turnaround, source infected sheet, and accepted common-worker hero proportions. Four rounds completed.

- Silhouette: enormous forward swollen belly, wide bent legs, heavy arms and hands, sparse dark hair around the bald scalp. Head is approximately one third of height; adult infected scale is approximately 1.72 m including hair tufts.
- Outfit: independent ivory open shirt shell and sleeves, ragged charcoal trousers, belt/buckle/loops, rear pockets and stitching, bare chunky feet with individual toes and nails. Final waist refinement removes the projecting rear belt.
- Face: sculpted cheeks, ears, angry brow ridges, raised nose/nostrils, carved open mouth, broken teeth, tongue, and emissive red eyes.
- Infection: concave carved belly sore with yellow pustules and pale pustule tips, smaller nodules, raised conforming blood marks and chin stream. Palette materials only; no image textures.
- Surface finish: smooth normals and applied subdivision, then deterministic density reduction. 38,956 triangles. Intentional garment tears and mouth/wound openings have recessed closing geometry.
- Animation: complete rigid hierarchy with shoulder/elbow/hip/knee/neck pivots. All seven stump caps are proximal children, carry hidden metadata, and export with zero scale.
- Pose proof: renders/pose-test.png shows armL, foreArmL and legR rotations, followed by the same pose with the left arm detached and stump_armL visible.
- Browser proof: renders/three-WebGPU-* and renders/three-WebGL2-*; both backends load without console errors. Export contains 22 meshes; material primitives produce 59 renderable meshes in the browser viewer.
- Automated validation: Python source syntax, exported nodes/hierarchy/caps, finite positions/normals, no degenerate triangles, no textures, palette-only materials, budget. Repository typecheck, lint and 25 unit tests passed.

Round history: 1 established the sculpted silhouette; 2 corrected blood projection and reviewed all four views; 3 corrected shirt coverage, trouser tatters and concave wound while reaching the triangle budget; 4 fitted the waist belt and added the reference trouser tear. Contact-sheet generation was consolidated into one helper.

Verdict: pass for this hero GLB and the requested rigid-part/pose/browser deliverables.
