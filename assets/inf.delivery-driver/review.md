# Delivery driver hero review

Final comparison: `renders/comparison.png`; final presentation: `renders/hero.png`.
Five visual rounds (initial build plus four refinements). Final comparison repeated after the curved cap-badge fix.

- Character silhouette: PASS from front, right side, rear and three quarter. Blue short-sleeve delivery uniform and cap, messy brown volumetric hair, large yellow pizza carrier, cargo pockets, torn knees and chunky dark trainers identify the reference archetype.
- Identity colours: PASS. Blue uniform, brown trousers, yellow parcel panels, red blood, emissive red infected irises. Materials use palette token names with reference-tuned colour values.
- Chibi proportions: PASS against the requested infected lesson: oversized head around one third of the silhouette, large claws and shoes; adult uniformed runner. Overall height 1.689 m.
- Face: PASS. Separate cheek/jaw volumes, ears, nose/nostrils, brows, eye whites/red emissive irises, open bloody mouth, individual teeth and drips. Eyes and mouth remain readable in the saved gameplay capture.
- Accessories and hidden sides: PASS. Curved cap brim, panel stitching and rear adjustment opening; multi-panel parcel with lid, piping, latches, rivets, pizza relief, straps/buckles; pockets, belt and layered shoes.
- Rigid motion and stump cap: PASS. `renders/pose-test.png` rotates armL/foreArmL/legR and reveals stump_armL, with the left arm moved away to expose the cut. The exported GLB probe confirms constant limb lengths, movement through child joints, stationary opposite arm and stationary torso-side stump.
- Geometry/runtime: PASS. 38,466 triangles, 74 meshes, zero degenerate triangles, no image textures, finite positions, all required infected nodes. Both soles rest at ground level. WebGPU and WebGL2 captures contain no console errors or warnings.
- Surface conflicts: PASS on the reviewed views. Curved relief is projected 4 mm above the actual surface; the cap badge is tessellated before projection so it follows the crown.
- Scope: asset-only delivery; the whole E17 production epic and registry integration are not claimed complete.

Known visual gap: fine fabric wear and the pizza graphics are simpler than the reference, represented by texture-free palette geometry. Crowd LODs are deferred as requested.

Validation logs: `validation.json`, `rig-validation.json`, `three-check.jsonl`, `typecheck.log`, `lint.log`, `unit-tests.log` (5 files / 12 tests passed).

Rebuild precision: PASS within 1 micrometre; measured maximum delta 0.000164 mm across 74 named meshes. Exact hashes differ at vertex-rounding boundaries, recorded as a report gap.
