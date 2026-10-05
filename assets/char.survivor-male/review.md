# Character review — char.survivor-male

Evidence: `renders/comparison.png` combines the untouched turnaround and final four views. Final render: `renders/hero.png` (1600 × 900, Cycles 96 samples); review views and pose: 960 × 540, 24 samples. Five build/review rounds (initial plus four refinement rounds).

## Visual result

The outfit identity is present: red varsity hoodie panels, cream sleeves/hood/inner shirt, charcoal rib cuffs, warm brown cargo trousers with flapped pockets, red high tops with cream toe caps and tongues, geometric laces, teal padded backpack with orange buckles and a raised corgi face patch. Both shoulder straps, the carry handle, drawstrings/aglets, snaps, trouser stitching, chest emblem and right-cheek bandage are modeled geometry. Hair is a solid cap with overlapping tapered sculpted locks; eyes have whites, irises, pupils, highlights and lids, with brows, ears, nose and smile. Final comparison corrected the mirrored cheek bandage/chest emblem and exposed the shoe tongues.

- Palette and outfit recognition: PASS.
- Chibi proportions and scale: PASS. Exported height 1.398519 m; head with hair occupies approximately the upper quarter.
- Separate clothing/accessories, smooth solids and applied subdivision: PASS.
- Geometry texture-free, soft-bevelled and game-loadable: PASS.
- Reference's sculptural richness: PARTIAL. The hair layering, sleeves and trouser folds remain more regular and simplified than the turnaround. Further art review is recommended for the requested highest hero quality. This is the remaining visual gap after the bounded five rounds.

**Verdict: needs-human for the final hero art-quality sign-off; technical export/animation contract passes.** No reference or spec files were edited.

## Animation / export

`validation.json` checks the actual GLB: all 19 required nodes, exact parent hierarchy and joint locations, all unit scales, ground minimum Y=0, no skins/textures, no nonfinite or degenerate triangles. Forward +X; Blender -Y is the character's right. Geometry is merged only within each rigid part: 16 glTF mesh records, split into 59 material primitives / Three.js Mesh instances. `report.json.meshes` uses the runtime count of 59.

Pose test rotates armL X=55° / Y=-35°, foreArmL Y=-65°, legR Y=-24°, shinR Y=25°. The raised/bent arm and stepping leg carry their child geometry and sockets. No infected stump caps are needed for this survivor. The exported GLB remains in the relaxed rest pose.

Two builds have exactly matching canonical triangle-position/material hashes (`determinism.json`). Whole GLB bytes differ due to serialization/accessor ordering; the geometry is identical.

## Runtime / repository checks

`three-check.log` and `three-full-check.json`: WebGPU and forced WebGL2 load 57,936 triangles with zero console errors or warnings. Standard study captures crop this tall character because of the existing viewer's camera framing; the additional `three-full-*` captures zoom out without changing the viewer. Both backends also have default gameplay captures.

Typecheck and lint pass. `npm run verify -- E17` passes its static/build steps and 8 smoke checks; all 13 Vitest tests in that selection are skipped because this repo has no E17-tagged tests yet. Full unit suite: 8 pass, 2 unrelated failures (M0 milestone selection and Vite bundle-size warning). Logs are stored beside this review. Those issues were not changed outside this asset's scope.
