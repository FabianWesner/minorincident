# QA invariant sweep evidence

Implementation in progress. Game code and existing tests are unchanged. This lane now has `lane/batch13i` (`ba436b90a`) as an ancestor; the original regression-gate docs and the first implementation checkpoint were rebased onto it once the environment permitted Git writes. Checkpoint: `ed209cddf`.

## Receipts

- `npm run qa:invariants:sim:remote` ran on runner `94.130.181.173`, immutable job `qa-invariants-38c23b-99380-1792695735`. The checkpoint suite finished in **227.36 s** (remote setup plus execution **241 s**, initial sync **102 s**). 13 tests passed, 2 failed.
- That checkpoint's **vehicle red** was real: the L4 tank path intersects `prop.privacy-fence:44`, `prop.privacy-fence:45`, and `l4-perimeter-1`, including the final stop pose. This catches P1-116 on batch13i game code.
- Its **three ground-center failures were not valid PO evidence**: lower slabs overlapped higher exposed paving/supports. The replacement compares the exposed top and additionally samples both authored S-ramps across their width using `highwayPoint`, following `lane/l3-road-gap`'s regression test without changing game code. The new probe reports 290 L3 deck/phantom-support violations on batch13i (P1-113/113b class), including `kit.highway-onramp:991`, `t=0.35`, lateral offset `1.1`, support `5.27 m`, drawn `5.07 m`.
- `npm run qa:invariants:proof` executes one deliberately broken fixture per subprocess. All **8 subprocesses exited 1 at their invariant assertion**; the proof driver exited 0. JSON receipt: `test-results/qa-invariants/broken-fixtures.json`. The normal fixture suite also checks the good twins and budget boundaries.
- The expanded accessory probe checks actual head instance matrices and inline merged geometry against source GLB bounds and authored fits: 1,296 model/LOD/tier combinations, 972 accessory-eligible combinations. Native civilian glasses are in the character GLB, so their head-relative face bounds are checked separately. The appearance tiers are frail/average/athletic; render quality paths are covered by the single Scene Lab spec.
- `npm run build` passed after moving onto batch13i (8.23 s). Typecheck/lint and the expanded remote/render sweeps are being rerun.

## Coverage and remaining work

| Check | Current coverage | Remaining receipt / work |
|---|---|---|
| 1 Accessory anchors | Source GLB head frames, authored fit scales, native glasses, instance and inline geometry, every crowd model × LOD × appearance tier | Expanded final run and Scene Lab draw receipt |
| 2 Seated NPCs | Active seat schedules sampled each sim second across L1–L10, seed 1 and campaign presets; live prop support and sitting height | Check missing rendered bench case, not only sim props |
| 3 Scripted actors | L1 clerk until walk-off, lab technician handover/return; actual cast submission in Scene Lab | Other authored scene lifecycles; technician hidden frames need scene-boundary review |
| 4 Vehicles | SAT OBB against solids; L4 tank and five-vehicle convoy route/stop; L2 truck; L7 bus; bike dismount samples plus fence-crossing check | Expanded result and remaining APC routes |
| 5 Waves | L4 alarm count, emitted wave counts, a reachability probe | Replace count-event-only evidence with admitted IDs reaching goals; extend authored wave inventory |
| 6 Objectives | Every step L1–L10 through actual activation/onStart, objective text, ObjectiveMarker update, L3 pull-back deadline | Final expanded receipt; L3 camera suppression is now caught |
| 7 Ground | All levels' exposed walkable support/paving routes; authored L3 ramp cross-sections and outside-rail samples | Final expanded receipt and joint-wedge samples |
| 8 Load time | One browser, built dist vs PROD, every level menu click through Begin to first drawn gameplay frame, WebGPU low; separate per-level receipts | Mac run is live under quiet-run; previous sandbox restrictions are resolved |

`npm run qa:invariants` collects both sim and render failures; a red sim no longer skips the Mac measurements. No 13g receipt has been gathered yet. No deploy or merge into another lane was performed.

## Expanded checkpoint receipt (19:34 UTC)

Runner `94.130.181.173`, job `qa-invariants-38c23b-89418-1792697616`: **241.40 s**, 20 tests, 12 passed / 8 red. Log: `test-results/qa-invariants/remote-expanded.log`. This measured both quality tiers and found twelve L6 `npc-sit` actors without a seat, 86 exterior technician hidden frames, the tank route/rotating hold intersections, L3 marker suppression, and the ramp failures. The initial wave-census fixture also found count shortfalls; these are **not yet attributed to game bugs** because its first L3 implementation advanced only the clock. The revised fixture runs real sim movement to clear the mouths and records admitted/reached IDs. L4 alarm high admitted 18 but only 12 reached the hold area in its first receipt; low reached all 9. A further fixture correction now parks the convoy at its authored stops before testing the alarm, so that result needs a new receipt too.

The latest implementation also covers every authored L4 wave-size entry and one collapse batch in isolation, native rendered bench submission at the L2 PO camera, the authored initial story cast in every level, and the individual registered crowd variants beyond the core civilian list. Validation and evidence for these additions are pending; no previous receipt is presented as proof of these new paths.
