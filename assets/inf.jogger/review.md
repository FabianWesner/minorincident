# inf.jogger — hero review

Five visual rounds, compared with reference-upscaled.png and the original/draft crop.

1. First four-view build: 36,759 triangles. Found undershirt breakthrough, visor hidden by fringe, small claws and cylindrical limbs.
2. 37,885 triangles. Fixed tank fit and visor placement, enlarged claws, rounded limbs; found rigid comb-like ponytail and rounded sleeve balloons.
3. 39,376 triangles. Applied hair subdivision with topology reduction, varied ponytail flow, tapered limbs and used cloth sleeve shells; found exposed upper sleeve openings and fringe intersection at visor edges.
4. 39,361 triangles. Closed shoulder ends of sleeves, tucked fringe behind band, baked a forward hunch while keeping translation-only joint defaults. Reviewed front, side, back and three-quarter.

## Character and asset checks

- PASS: pink visor/sports tank, charcoal cuffed shorts, voluminous chestnut ponytail, waist pouch, watch, socks and chunky pink high tops identify the runner from all four views.
- PASS: oversized head and hands follow the job's later ~1/3 head guidance; adult athletic torso, exposed legs and infected face. Revised height including loose hair is 1.674 m.
- PASS: explicit eye whites, emissive red irises, pupils, lids, angry brows, fused cheek/nose/jaw sculpt and open snarl with individual teeth, tongue and chin drips.
- PASS: pink athletic clothing and blood retain strong separation. Palette-token material names, scalar Principled materials, no image textures.
- PASS: soft applied subdivision/bevel surfaces and smooth shading. All meshes ship without modifiers; large meshes receive topology reduction to fit the infected hero budget.
- PASS: blood patches ray-fit at 3.5 mm clearance; cloth tears, hem tabs and blood drips are geometry. Visor, sleeve and tank fit corrected through review.
- PASS: +X forward, +Z up, model's right is -Y; sole bottoms are on z=0.
- PASS: GLB contract validator checks required nodes, parent chains, seven stump nodes, zero-scale hiding and restoration metadata, finite vertex/normal data, valid indices, no textures/skinning and material names.
- PASS: pose test rotates armL/foreArmL/legR, separates armL slightly and shows the surviving-shoulder stump_armL. The hand follows the elbow; the right shin and shoe follow the hip.
- PASS: WebGPU and WebGL2 preview captures report errors=[] and the same 57 meshes / 39,361 triangles.

The rigid-part GLB is the requested LOD0; crowd/LOD derivatives are deferred by the brief. Pink is the reference tint of pal_survivorRed, and the hair is a dark chestnut tint of pal_woodWarm, as in the existing standalone character-build material pattern.

Final review complete: inspected the 1600×900 / 96-sample hero, 1920×1080 four-view turnaround and final WebGPU/WebGL2 captures against the upscaled reference once more. Pink athletic identity, large head/claws, forward hunch, blood and accessory silhouettes remain readable. No further surface-fit corrections were needed. Reviewed build.py for unnecessary complexity: fixed deterministic helper geometry, applied tessellation, per-joint material merging and a short rest-pose bake are retained; turnaround composition now reuses the four review images without a second render. Required output sizes and final backend statistics were checked programmatically.

## Orchestrator revision r2 — fifth visual round

Compared again with reference-upscaled.png and accepted inf.common-worker/renders/hero.png. The previous narrow face and hanging arms were rejected by the orchestrator. Head, hands and shoes are now substantially broader; the enlarged glowing irises and open toothy mouth remain clear beneath the visor. Bent knees, forward torso and chest-height reaching claws establish the requested lunge. Thick ponytail/visor and pink athletic clothing remain intact.

Inspected revised hero, front/side/back sheet and pose-test. Foot soles are grounded in rest. ArmL/foreArmL/legR rotations and stump_armL toggle still work after the proportion bake. Contract validator passes at 39,361 triangles and 57 meshes. Final WebGPU/WebGL2 captures both report errors=[] and height 1.674 m. Artifact dimensions checked. New proportional transforms are joint-centered; the existing material merge and subdivision/reduction helpers are reused.
