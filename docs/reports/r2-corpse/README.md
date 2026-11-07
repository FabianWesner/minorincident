# r2-corpse: corpse death poses (G-14, L4-17)

Branch `lane/r2-corpse`. No deploy, no push. Contact sheet: `docs/reports/r2-corpse/contact-sheet.jpg`.

## Result per item

| Item | Status |
| --- | --- |
| G-14 pointed/folded limbs, floating/propped bodies | **Fixed for all humanoid rigs** (every infected human, Alpha variants, Mega, firefighter, riot cop, hazmat, elderly, killed civilians). Not touched: dog (already flat, 0.44 m), crawler, gorilla, lion, zebra, flamingo, elephant (animal/non-upright rigs keep their authored fall; elephant lies 2.49 m, gorilla 2.22 m, not in scope). |
| L4-17 corpse vertex tops | **Improved, not at ~1 m.** Body part: Alpha 1.51-1.90 m to 0.96-1.29 m (base Alpha 1.05); Mega 2.4 to 1.7-1.9 (4 m figure). Level route: low 2.045 m to 1.391 m, high 1.825 m to 1.391 m (same blk-v method). The remaining peak is the unrepaired crawler (0.90 m) on a heap root lift of 0.49 m (layout, not pose). |

## Cause and fix

The authored death clips themselves ended propped (hip 0.6 m up, bent knees/elbows, wrists at the sky), and the Alpha's arm joints sit about 1 m from the mesh limbs they drive, so any joint-to-joint repair failed there. `src/render/characters/deathPose.ts` (`repairDeathPoses`) re-poses the three death clips once on the clip matrices, at the load sites (`civilianBake.ts` after decode, `CrowdView.ts` fallback bakes), replacing `proneDeath` for Alphas:

1. End pose = the model's own rest pose (inverse binds) laid on the floor: face up (back), face up with asymmetric limbs (side), face down (crumple). Alphas face down in all three.
2. Each whole limb (arm+forearm+hand, leg+shin+foot) turns as one rigid unit about its shoulder/hip so its real mesh axis (vertex centroid) lies flat and slopes to the floor; hunched Alpha upper body is straightened about the hip and a head-end pitch (0-50 degrees) is searched for the flattest body.
3. The lowest real vertex is set on y = 0 (floor fit, exact on all vertices).
4. Blended from the authored fall by a per-frame weight, so live dying figures and frozen corpses share rows.

Mesh, skin weights, UVs and files are untouched. Budgets unchanged (Alpha 4888 / 2510 / 814 triangles, 379 / 209 / 84 KB; class budget 8000 / 3000 / 1000 tris, 800 KB). CPU cost per load: Alpha LOD0 35 ms, LOD2 25 ms, ordinary humans 2-5 ms (node, loaded machine).

## Numbers (vertex tops in m, before to after, worst of the three clips)

Method: delivered LOD0 bakes, production skinning of the last frame (`tools/qa/r2-bounds.mjs`, before = old `proneDeath` path). Floor error stays within 2 cm.

See table in `docs/reports/r2-corpse/bounds-table.md`. Highlights: common worker 0.95 to 0.48, bathrobe 1.22 to 0.92 (crumple got higher, 0.63 to 0.92), bbq dad 1.40 to 0.83, suburban mom 1.27 to 0.98, firefighter 1.20 to 0.94, riot cop 1.26 to 0.94, alpha 1.90 to 1.09, alpha-hoodie 1.90 to 1.26, mega 2.41 to 1.91. A few single clips got taller (riot back 0.75 to 0.94, alpha-worker crumple 0.97 to 1.15): rest-pose volume lying down.

L4 route (`tools/qa/blk-v-l4-corpses.ts`, receipts in `test-results/blk-v/r2final`): low 442 samples, 400 frozen, max top 1.391 m; high `--war-only` 184 samples (the full high route hit the 10 min browser cap under load 12-15), max top 1.391 m. 379 and 260 permanent corpse IDs retained; nothing removed.

## What I saw (captures I opened)

- Side-on Alpha line-up, high WebGL2: before, hunched figures standing on boots, 1.5+ m; after, face-down mounds about 1 m, one body each, no pointed limbs (sheet top row).
- Alpha live fall sheet (every 3 frames): stands, topples, settles prone by frame 36 without limb snapping.
- All variants, game camera zoom 0.5 and zoom 1.5, high and low, WebGL2, plus WebGPU (low all, high z0.5/z1.5-alpha group/civilians): flat, readable bodies (worker, nurse, hazmat, firefighter, riot cop, dog, Mega, three Alpha looks). WebGL2 and WebGPU frames look the same.
- Killed civilians (elderly, officer, guard, kid, adults), low WebGPU: all lie flat with arms at sides.
- Not seen in a capture: zoom 1.5 low WebGPU for the z15-1/2/3 groups, and WebGPU high z15-1..3 (z15-0 and z0.5 were).
- Weak points: Alpha torso is about 1.1-1.2 m deep as built, so 1 m needs a model change or a vertical squash (not done, affects hat/accessory matrices); Alpha looks vary 0.96-1.29 m.

## Checks

`npx tsc --noEmit` pass; `npm run lint` pass; `npm test` 107 tests pass (new checks folded into `tests/shared/render-contracts.test.ts`, budget 150 held); `npm run scene:gate` 50/50 rows pass (final code, 8.3 min); qa:threat not run (1-min load 10-15 > 6).

## Added tooling

`tools/scenelab/gen-corpse-sweep.py|civ|one|fall.py`, scenes `tests/scenes/catalog/corpse-{sweep,z05,z15-*,civilians}.json`, Scene Lab `{ corpse: true, ageTicks }` and corpse support for pedestrians, `tools/qa/r2-*.{mjs,py}`.
