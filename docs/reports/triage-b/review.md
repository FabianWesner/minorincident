# Current visual and campaign review

Runtime baseline: main `305071ff2`; fixes through `9fd194de0`. Browser work uses the shared headless pool on private ports, native Metal, WebGPU or WebGL2 as recorded in each receipt. These are shared-host functional and visual checks, not quiet-window performance measurements.

## Fixes inspected

| Item | Change | Viewed evidence |
|---|---|---|
| Q-146 | Road paint is now 4 × 1.4 m, muted tan, with a narrow tail. Rebuilt base, terrain cells and horizon. All parsed layout sections except geometry hash are identical; colliders, placements and routes are unchanged. | [Before](captures/before-webgpu-high/l9-arrow/shot-0000.png) / [after](captures/after-webgpu-high/l9-arrow/shot-0000.png): oversized white arrow no longer cuts through the APC. [Identity receipt](checks/q146-layout-identity.json). |
| Q-147 | Inward feather on the Alpha warning circle; attack radius and timing are unchanged. | Matched frame 59 [before](captures/before-webgpu-high/slam/shot-0059.png) / [after](captures/q147-webgpu-high/slam/shot-0059.png): red warning remains visible, without the hard polygon rim. |
| Q-148 | Rocket screen flash capped at .2 (.12 with flash reduction); duplicate legacy rocket pulse removed. Fireball, local light, damage and shake remain. | Matched frame 18 [before](captures/detail-webgpu-high/pointblank-rocket/shot-0018.png) / [after](captures/q148-webgpu-high/pointblank-rocket/shot-0018.png): scene stays readable around the hot fireball. Unaffected corner mean luma 147.93 → 79.08 ([receipt](checks/q148-pixels.json)). |
| Q-156 | One boarding count; missing names and the pin use the same nearest-passenger order. | Actual L8 HUD [before](captures/before-webgpu-high/boarding.png) / [after](captures/after-webgpu-high/boarding.png), with [exact text](captures/after-webgpu-high/boarding.json). Staged boarding state, not a natural playthrough. |
| Q-185 | Live debug selection awaits preparation of the newly selected courier model. | Actual L1 [before](captures/before-webgpu-high/variant-male.png) / [after](captures/after-webgpu-high/variant-male.png); after selection reports `char.courier-male.skin` and `skinned: true`. No readiness call between selection and capture that could conceal the bug. |

Q-146 horizon is 318720 bytes versus 250152 before (+68568). Terrain cell max is 300 triangles; horizon 9904 versus 9915 triangles. This is a visual-only change with a small asset-byte increase, not a claim of improved cold-load performance.

## Bodies, ground effects and readability

Viewed all four final healthy/infected corpse pairs at z1.5 (high/low × L4 day/L8 zoo night), plus the [near comparison](captures/corpse-near-review.jpg). Each receipt retains the six model/entity identities. Bodies have settled for 120 ticks; healthy NPCs use the finished-state path, infected use the permanent frozen-body path. This isolates presentation and does not prove natural death/progression logic.

Day: blue, yellow and guard clothing remain distinct; infected expose green skin and wound markings. Night: faces and pale garments remain readable, but dark legs/lower bodies merge with grass at z1.5 on both tiers. Q-247 remains open. The old Q-244 frozen-fill reduction applies globally, so increasing global corpse fill would risk the L10 cure presentation.

Q-184 is fixed-before: viewed current high/low male t1/t2 torso pairs and game-camera idle captures. T1 is orange/white shirt with green pack straps; t2 has a dark olive quilted vest across the torso, with a zipper and pocket panels. Both colour and coverage are distinct. This is the later textured garment-shell rollout (`a44725f64`, retained at low by `f82481767`), not a new swatch change in this lane. The captures use closest player zoom .5 and a separate explicit torso pose; they are native evidence of the current materials, not an all-distance visibility guarantee.

Viewed the [close night blood control](captures/detail-webgpu-high/blood/shot-0120.png): irregular textured splats, no confetti squares. It does not reproduce the exact historic L7/L10 decal source; Q-143/Q-176 remain open for an event/texture-specific reproduction. Viewed the [L6 arch fixture](captures/before-webgpu-high/l6-tunnel-walkway/shot-0075.png): courier remains visible with a slight ordered reveal texture; Q-241 remains open for further arch-specific work.

Low-tier VFX control sheets are retained under `captures/review-webgpu-low/`. All focused runs report zero browser errors. Fixture passes alone do not establish artistic acceptance.

## Motion sheets inspected

The retained [gate evidence](checks/scene-gate/state.json) identifies the actual requested backend/tier for each row. Viewed female walk/run transitions and turns, high-tier pedestrian walks, low-tier dog trot, female tier-4 melee/death contact, corpse piles, and Mega arrival sheets. Sampled poses retain limbs, hats, fitted gear and readable actor silhouettes; no detached gear or stretched triangle is visible in these controls. Gear attachment gates remain within 2 cm. The sparse sheets do not establish frame-perfect foot planting or close the missing historic actor/tick from Q-231. The pile control retains all bodies and still looks deliberately crowded; small-body walk-through remains Q-22. The arrival control is staged and does not establish the actual L10 approach duration, which is covered by the linked calibrated gameplay report and current input run.

## Campaign, motion and story

Current real-input route and movement-sheet findings will be recorded here after their terminal results and capture review.

