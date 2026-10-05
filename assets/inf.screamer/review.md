# Screamer visual review

Reference: `reference-upscaled.png`, `reference.png`, source sheet `initial-drafts/zombies-emergency-workers-and-mutants.png`; proportion comparison `assets/inf.common-worker/renders/hero.png`.

## Round 1

Four views: `renders/round1.png`, `round1-front.png`, `round1-side.png`, `round1-back.png`.
- Identity: ivory jacket, red top, charcoal shorts, belt straps and red/white high tops match. Raised hands and huge screaming face read immediately.
- Proportions: broad skull plus hair approximates one third of the 1.73 m silhouette; chunky hands and bare bent legs follow the accepted infected proportions.
- FAIL hair finish: locks were too uniformly light and ordered; back scalp band exposed. Refine with a darker woodWarm shade, staggered upper layers, and irregular swept tips.
- Refine stance: torso too upright; bake forward lurch into rest pose without losing the raised hands.
- Export: 35,725 triangles, all required nodes, proper parent hierarchy and hidden proximal caps. No textures or skinning.

## Validation scope

This task delivers the isolated art asset inside its own directory. It does not change the registry, inventory, runtime, or epic status. Repository typecheck, lint and 25 unit tests pass. Asset-specific GLB structural checks and both real renderer backends will be reviewed for final delivery.

## Round 2

Four views: `renders/round2.png`, `round2-front.png`, `round2-side.png`, `round2-back.png`.
- PASS mane coverage and stronger wind-swept silhouette. Upper rear locks close the exposed scalp, darker brown base matches the reference better, broad lock volumes remain smooth.
- PASS raised hands, exaggerated scream and forward torso lean. Gloves are absent as in the reference; bare hands have curled fingers, thumbs, nails and wrist straps.
- Refine jacket front: its horizontal wrinkle ridges read too strongly as strips. Replace with softly subdivided broad front panels and keep only subtle vertical folds.
- Export: 35,867 triangles, all required nodes present.

## Round 3

Four views: `renders/round3.png`, `round3-front.png`, `round3-side.png`, `round3-back.png`.
- PASS recognizable Screamer silhouette: large wild mane, raised claw hands, oversized screaming head, wide bent bare legs. Rear hair now fully covers the scalp.
- PASS outfit and color separation: ivory front panels and hood, coral tank, dark torn shorts with leather belt and side straps, red high-top sneakers with ivory soles/toes/laces.
- PASS face: projecting brows, nose/nostrils, bright red emissive eyes, carved dark mouth, bloody lip rim, upper/lower gums, separate teeth and tongue.
- PASS sculpted geometry: applied smoothing on the broad forms; softly beveled fastenings and soles; ragged hems and openings stay readable. No image textures.
- PASS contract: 35,939 triangles (under 40k), named rigid parts, unit-scale/zero-rotation rest joints, proximal hidden caps. Model floor is within 0.2 mm of z=0.
- Small intentional deviations: use the accepted Worker's exaggerated head/hand proportions instead of the taller original crop; retain the upscaled reference's raised hands rather than the lowered-arm side frames of the original crop. Brown hair is a darker value of woodWarm to match the reference under the studio light.

## Round 4: reproducibility and final delivery

The geometry helpers now build sphere topology explicitly and canonicalize Boolean output before Decimate. Tiny deterministic tie offsets and explicit transform selection make repeated exports byte-identical; `determinism.json` records the verified hashes. Final count is 35,916 triangles in 74 meshes.

The final GLB passes `validate.py`: all 24 named contract nodes, correct rigid hierarchy, seven hidden proximal stump caps, palette-only materials, finite geometry, no skins and no image textures. `rig-runtime-check.json` proves a fixed shoulder pivot, following hand/knee, and a cap retained on the torso. Both browser backends report no errors or warnings in `browser-check.jsonl` and have front/rear study and game-camera captures. Repository typecheck, lint and all 25 unit tests also pass.

The duplicate sheet-assembly code was removed and the front cloth ridges were simplified into real jacket panels. The topology-order helper remains because it is necessary for deterministic game-ready exports.

### Final comparison and verdict

Final `renders/hero.png` (1600x900, 96 samples), `renders/turnaround.png` (front/side/back/three-quarter), and `renders/pose-test.png` opened and compared again with the clean reference. PASS: hair mass and swept silhouette, raised hands, open scream and luminous eyes, ivory/red/dark outfit separation, chunky infected proportions, purposeful clothing/footwear details, consistent rear model. The final mesh remains smooth and readable at the game camera. The shoulder cap is clearly visible on the remaining torso in the pose test, while the detached arm's elbow/hand follow correctly and the rotated right leg stays articulated.

PASS all required delivery files and render dimensions. Final rebuilt model is byte-identical to both verification builds. Browser captures use that same final model and report no errors or warnings on WebGPU and WebGL2. No outstanding task gaps. The lower-density crowd LODs are intentionally deferred as requested.
