# QA invariant sweep evidence

Game baseline: **batch13i `ba436b90a`**. The lane contains no game-code changes and does not change existing test assertions. The gate deliberately exits red on this baseline; fixing those game defects belongs to the other lanes.

Run instructions: [regression gate](../../qa/regression-gate.md). Detailed scene, route, asset and wave inventory: [coverage](coverage.md).

## Red evidence by requirement

| # | Check | batch13i observation | Broken-fixture proof |
|---|---|---|---|
| 1 | Accessory anchors/scale | Completed 2,484 model × LOD × appearance-tier × accessory combinations (2,106 eligible). Red: 15 model/LOD pairs have no authored head skin: paramedic aftermath and the four individually registered survivor-group aftermath variants. The remaining measured fits obey their head bounds; all 30 authored native-glasses head/LOD cases preserve their face vertices on the head at authored scale. This is additional coverage, not a claim to reproduce the exact PO screenshot. | Hat attached to `hat` with a 40 cm head offset is rejected. |
| 2 | Seat support | Red: six L6 `npc-sit` actors per quality tier have no seat, twelve distinct findings. This applies the requested strict seat rule, including floor-sitting clips. Native L2 bench submission/body-pixel checks pass in Scene Lab on both tiers: 467/468 changed body pixels per bench when its geometry is suppressed. | Remove the seat under a sitting actor. |
| 3 | Scripted actors | Depot clerk completes the return without a state-level disappearance. Red: lab technician is hidden outside the doorway for 86 frames during handover/return. The all-level watch includes poses, mission allies, survivor rosters and staff, including L3/L4 and L7/L8 cast without a pose clip; late firefighter/lookout scenes have separate probes. | Hide an actor while its scripted scene is active. |
| 4 | Vehicles/solids | Red: 26 tank route/rotating-stop conflicts, including `prop.privacy-fence:45` and `l4-perimeter-1` (P1-116). L8 parked bus/APC and L9 crash poses pass the extended structural check. | Put a rotated OBB inside a structural AABB. |
| 5 | Wave count/arrival | Red: L1 exits finish 3/5 emergence routes; market ambush admits 19/24 high and 9/12 low; three L6 entry sides fail tunnel arrival; L4 war waves have arrival shortfalls, collapse admits 6/9 high and 4/6 low. Both L4 first alarms pass (18/18 and 9/9); every L3 wave, L7 group, L8 outlet and L10 assault passes the revised count/goal fixture. These additional wave failures are not all attributed to a particular PO report. | Replace the authored 18-member arrival with one member. |
| 6 | Objective visibility | Red: the shared story-shot rule hides active waypoint guidance beyond 2 s, including the L3 checkpoint (P1-114). Every step is checked normally and every waypoint step under a held 120-tick camera overlay. The overlay probes do not claim every step has an authored pull-back. | Hide the marker beyond the 2 s deadline. |
| 7 | Ground | Red: 290 L3 height/phantom-support samples violate 20 cm (P1-113/113b class). Example: `kit.highway-onramp:991`, `t=.35`, lateral offset 1.1 m: sim 5.27 m versus drawn 5.07 m. | A 21 cm support/drawn-height mismatch. |
| 8 | Load time | All ten levels measured on Mac WebGPU low: nine pass; L8 is red at 24.662 s candidate versus 23.145 s PROD (+1.517 s), exceeding the 1 s delta budget. | 1,110 ms candidate versus 1,000 ms baseline exceeds 10%; a separate test proves the independent 1 s delta limit. |

`npm run qa:invariants:proof` passed: **all eight selected fixture subprocesses exited 1 at their own invariant assertion**, while the proof driver exited 0. The normal fixture tests also prove the good twins pass. [Committed receipt](broken-fixtures.json). The fixtures prove the predicates reject their broken inputs; real level/asset and browser probes provide the integration coverage described above.

## Execution receipts

- Final committed complete suite `46c743520`: runner `2.31.10.108`, job `qa-invariants-38c23b-4220-1792703296`, **325.14 s**, **27 tests: 17 passed / 10 red**, no timeout. Remote total **328 s**, sync **39 s**. [All assertion details](sim-receipt.json), [wave counts and unreached poses](wave-receipt.json). The same global camera-suppression rule is exposed in 39 waypoint overlay probes, including L3's actual checkpoint case. Normal activation is checked separately.
- Final head-selection/native-glasses probe `46c743520`: runner `94.130.181.173`, job `qa-invariants-38c23b-99642-1792703104`, **19.47 s**. All 2,484 accessory combinations and 30 native head/LOD cases complete; only the same 15 missing head-skin pairs are red. Head and other pose joints have distinct transforms. [Asset receipt](accessory-receipt.json).
- Physical-exit probe `46c743520`: runner `94.130.181.173`, job `qa-invariants-38c23b-94409-1792702903`, **160.20 s**. The clerk and technician physically reach their authored return points; the actor case is red only at the 86-frame visibility assertion. [Exit receipt](exits-receipt.json).
- Mac quiet-run completed: **224.80 s** browser execution, **11 tests: 10 passed / 1 red** (L8 load budget). All ten loads have real WebGPU/low/playing/draw-call observations; Scene Lab cast and bench pixels pass on both tiers. The Mac stage took **1,073.15 s including admission**, using one browser. [Measurements and Scene Lab evidence](browser-receipt.json).
- The full `npm run qa:invariants` command was exercised at checkpoint `5faea408a`: its busy-runner sim completed in **421.38 s** (433 s remote total, 59 s sync), the dist build passed in **6.29 s**, and it continued to the Mac measurements despite the sim reds. The final committed-suite receipt above validates the completed inventory. Even that busier remote execution is below 15 minutes. The remote command has an 840 s execution ceiling; queue/admission wait is reported separately.

Raw logs and full framework JSON remain under `test-results/qa-invariants/`.

Earlier provisional failures were corrected in the test fixtures: a stale bike dismount point, comparison against a buried lower slab, a clock-only L3 wave dispatch, an unparked convoy in the L4 alarm fixture, and premature/overlong load waits. Those discarded observations are not presented as game bugs.

## Built dist versus PROD, WebGPU low

Candidate bundle `index-BWZZRFZr.js`; PROD bundle `index-D4kxfJBx.js`. The budget is the smaller of 10% or 1 s above baseline. These are single cold-context observations under exclusive quiet-run admission.

| Level | Candidate (s) | PROD (s) | Delta (s) | Result |
|---|---:|---:|---:|---|
| L1 | 2.518 | 2.631 | -0.113 | pass |
| L2 | 3.111 | 3.078 | +0.033 | pass |
| L3 | 3.531 | 3.712 | -0.181 | pass |
| L4 | 3.761 | 4.244 | -0.483 | pass |
| L5 | 4.763 | 5.094 | -0.331 | pass |
| L6 | 2.916 | 3.315 | -0.399 | pass |
| L7 | 3.962 | 4.160 | -0.198 | pass |
| L8 | 24.662 | 23.145 | +1.517 | RED |
| L9 | 9.161 | 9.728 | -0.567 | pass |
| L10 | 9.033 | 9.366 | -0.333 | pass |

## Cheap 13g reproduction

`npx tsx tools/qa/probe-baseline.ts lane/batch13g` exited **1 / red** against `769d9f8ce07ca3a6dc0db244a8c33122bd12dc22`: **299 tank poses, 26 distinct route/stop conflicts**. It reads the historical layout from Git and first verifies byte-identical tank authoring, dependent data, physics shapes and scripted controller source. [Exact source hashes and intersections](historical-tank-13g.json). This is a historical tank component probe, not a full 13g campaign/render run. No baseline worktree or second build was created.

## Validation and limits

- Typecheck and lint pass. Build passes.
- Unit suite: **1,971 passed / 2 existing failures**: `tests/unit/static.test.ts` sees the existing extra `preview/lighting-spike.html`; `tests/unit/tools/remote-cache-gc.test.ts` fails its Linux-shell cleanup expectation on this Mac. Neither test nor its implementation was changed.
- Rendering is one headless Chromium browser, one worker, native Metal/WebGPU, private ports 4191/4192, `E2E_UNITS=1`, admission timeout 3600 s, through quiet-run and the reentrant e2e-lock wrapper. No deploy, merge into another lane, or game fix was performed.
- These fixtures measure the invariant at authored scene/phase starts. They do not replace the visual A/B and PO checks for animation aesthetics, corpse appearance or combat balance.
