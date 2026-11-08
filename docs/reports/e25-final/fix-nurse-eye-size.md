# AC13: subpixel nurse eyes

The nurse's skinned eye quads had radii of only 5.46–5.86 mm across its three LODs. The ordinary game camera produced zero source-bound eye fragments, including in the lower-angle diagnostic. This was a separate authoring defect from the night body highlight ceiling.

`tools/assets/e25-nurse-eyes.ts --apply` enlarges only the two existing eye quads to 18 mm about their original centres. It updates the authored `model.skin.glb`, all three shipped LODs and their low variants, then regenerates only the nurse's three delivered crowd bakes and manifest entries. The repair is idempotent. Every non-eye accessor (body vertices, UVs, normals, indices, joints, weights and inverse-bind data) is byte-identical after decode. [Per-file hashes and accessor proof](evidence/nurse-eye-repair.json).

Fresh source-bound production-depth masks at the same game pose pass on **high and low**: body maximum **0.101106**, eye maximum **0.172990**, **two visible eye pixels**, zero browser errors. The before and after captures were opened and reviewed: `test-results/epics/E25/final/nurse-before-after.png`. The teal outfit, head/hair silhouette, pose and surrounding floor stay in place; the two small red eyes now read on the face. No reference image was edited.

The final lane report records the complete retained-archetype/tier matrix and accepted-scene regression evidence.
