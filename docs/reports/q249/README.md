# q249 crowd proportions (work in progress)

## Measurement basis

Measured from bind-pose game meshes after source-body reconstruction and before LOD export. Head height begins at the authored head-bottom joint plane; total height is ground to crown. Head width is lateral extent above the plane; shoulder width is the torso/upper-arm band 5–15 cm below it. Leg height is ground to hip joint. The approved heroine is unchanged.

Heroine reference: head/total **0.2440**, head/shoulder **0.8719**, leg/total **0.4275** (shipped `char.courier-female.skin.glb`). The bake target is head/total 0.244044566 and head/shoulder 0.8718.

| Variant | Before head/total / head/shoulder / leg/total | After head/total / head/shoulder / leg/total |
| --- | --- | --- |
| heroine | 0.244 / 0.872 / 0.428 | 0.244 / 0.872 / 0.428 |
| inf.bbq-dad | 0.325 / 0.799 / 0.360 | 0.244 / 0.872 / 0.404 |
| inf.brute | 0.249 / 0.576 / 0.381 | 0.244 / 0.872 / 0.384 |
| inf.suburban-mom | 0.369 / 1.217 / 0.418 | 0.244 / 0.872 / 0.500 |
| npc.civilian-adult-f | 0.287 / 1.091 / 0.475 | 0.244 / 0.872 / 0.504 |
| npc.civilian-adult-m | 0.263 / 1.655 / 0.416 | 0.244 / 0.872 / 0.426 |
| npc.civilian-man-a | 0.263 / 1.655 / 0.416 | 0.244 / 0.872 / 0.426 |
| npc.civilian-man-b | 0.289 / 0.806 / 0.405 | 0.244 / 0.872 / 0.431 |
| npc.civilian-woman-a | 0.282 / 0.974 / 0.481 | 0.244 / 0.872 / 0.506 |
| npc.civilian-woman-b | 0.287 / 1.091 / 0.475 | 0.244 / 0.872 / 0.504 |
| npc.depot-clerk | 0.337 / 1.268 / 0.354 | 0.244 / 0.872 / 0.404 |
| npc.firefighter-alive | 0.289 / 1.655 / 0.398 | 0.244 / 0.872 / 0.424 |
| npc.lab-guard | 0.320 / 0.580 / 0.364 | 0.244 / 0.872 / 0.404 |
| npc.lab-tech-b | 0.316 / 1.605 / 0.365 | 0.244 / 0.872 / 0.404 |
| npc.national-guard | 0.262 / 1.256 / 0.448 | 0.244 / 0.872 / 0.459 |

The head ratios in the completed receipts are at target. The leg ratios are **not** all within the heroine's ±10% interval (0.385–0.470); those outliers remain unfinished and must be corrected with a rig-safe bind-pose change before acceptance. This table covers only variants with successful current build receipts, not the full cast roster.

## Current status / outstanding acceptance checks

- Source bake calibration and generated LOD/corpse outputs are partial; children, named survivors, remaining civilians and infected are not all rebuilt.
- Mug dimensions/socket were changed to a 10 cm held mug; visual hand fit is not yet confirmed. Cap placement and bench sitter correction are not yet verified.
- No before/after lineup sheet, zoom 1 readability review, 3 m close view, high/low review, L1 depot/bench capture, or infected/corpse visual review has been completed.
- GPU limits, no late shader builds, L1 load delta (±0.3 s), and `npm run scene:gate` 48/48 remain unverified.
- `npm test` passed (26 files / 110 tests). `npm run typecheck` passed. `npm run test:smoke` was blocked by browser-pool startup: parent workspace cache permission denied, then pool port 4329 bind returned EPERM.
- The requested `v2/PLAYBOOK.md` update and lane commit in `minorincident_3dpipeline` could not be made because that checkout is outside this job's writable roots.
