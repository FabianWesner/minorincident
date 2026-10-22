# QA invariant sweep evidence

Game baseline: **batch13i `ba436b90a`**. The lane contains no game-code changes and does not change existing test assertions. The gate deliberately exits red on this baseline; fixing those game defects belongs to the other lanes.

Run instructions: [regression gate](../../qa/regression-gate.md). Detailed scene, route, asset and wave inventory: [coverage](coverage.md).

## Red evidence by requirement

| # | Check | batch13i observation | Broken-fixture proof |
|---|---|---|---|
| 1 | Accessory anchors/scale | Completed 2,484 model × LOD × appearance-tier × accessory combinations (2,106 eligible). Red: 15 model/LOD pairs have no authored head skin: paramedic aftermath and the four individually registered survivor-group aftermath variants. The remaining measured fits/native glasses obey their head bounds. This is additional coverage, not a claim to reproduce the exact PO screenshot. | Hat attached to `hat` with a 40 cm head offset is rejected. |
| 2 | Seat support | Red: six L6 `npc-sit` actors per quality tier have no seat, twelve distinct findings. This applies the requested strict seat rule, including floor-sitting clips. Native L2 bench submission and body-pixel checks run in Scene Lab. | Remove the seat under a sitting actor. |
| 3 | Scripted actors | Depot clerk completes the return without a state-level disappearance. Red: lab technician is hidden outside the doorway for 86 frames during handover/return. Initial cast includes L2 (16), L5 (24) and L6 (29) per tier; late firefighter/lookout scenes have separate probes. | Hide an actor while its scripted scene is active. |
| 4 | Vehicles/solids | Red: 26 tank route/rotating-stop conflicts, including `prop.privacy-fence:45` and `l4-perimeter-1` (P1-116). L8 parked bus/APC and L9 crash poses pass the extended structural check. | Put a rotated OBB inside a structural AABB. |
| 5 | Wave count/arrival | Red: L1 exits finish 3/5 emergence routes; market ambush admits 19/24 high and 9/12 low; three L6 entry sides fail tunnel arrival; L4 war waves have arrival shortfalls, collapse admits 6/9 high and 4/6 low. Both L4 first alarms pass (18/18 and 9/9); every L3 wave, L7 group, L8 outlet and L10 assault passes the revised count/goal fixture. These additional wave failures are not all attributed to a particular PO report. | Replace the authored 18-member arrival with one member. |
| 6 | Objective visibility | Red: L3 checkpoint marker remains hidden at the 2 s deadline during the camera pull-back (P1-114). Every authored mission step is probed. | Hide the marker beyond the 2 s deadline. |
| 7 | Ground | Red: 290 L3 height/phantom-support samples violate 20 cm (P1-113/113b class). Example: `kit.highway-onramp:991`, `t=.35`, lateral offset 1.1 m: sim 5.27 m versus drawn 5.07 m. | A 21 cm support/drawn-height mismatch. |
| 8 | Load time | Ten built-dist/PROD timing cases run on the Mac with WebGPU low. Final receipt is recorded below when the quiet-run comparison completes. | 1,110 ms candidate versus 1,000 ms baseline exceeds 10%; a separate test proves the independent 1 s delta limit. |

`npm run qa:invariants:proof` passed: **all eight selected fixture subprocesses exited 1 at their own invariant assertion**, while the proof driver exited 0. The normal fixture tests also prove the good twins pass. [Committed receipt](broken-fixtures.json). The fixtures prove the predicates reject their broken inputs; real level/asset and browser probes provide the integration coverage described above.

## Execution receipts

- Full command checkpoint `5faea408a`: runner `2.31.10.108`, immutable job `qa-invariants-38c23b-57335-1792699634`, **421.38 s** Vitest execution, **433 s** remote total, **59 s** sync. **23 tests: 13 passed / 10 red**. No timeout. The command continued through a successful dist build (6.29 s) into Mac browser admission despite the sim failures.
- The preceding expanded sweep on `94.130.181.173` finished in 258.88 s; the busier runner receipt above is still below the 15-minute remote budget. Queue/admission wait is reported separately. The remote command has an 840 s execution ceiling.
- Extended all-level start/park/crash vehicle probe: runner `94.130.181.173`, job `qa-invariants-38c23b-72187-1792699769`, **33.44 s**, passed. It sampled 322 L9 poses, four L8 poses, and all initial live vehicles.
- Complete inventory rerun `c41b19903`: runner `2.31.10.108`, job `qa-invariants-38c23b-92215-1792700261`, **357.21 s**, **27 tests: 16 passed / 11 red**. One of those reds was the new lookout fixture allowing a resident infection; the corrected visibility fixture isolates that valid combat exit and passes both tiers in 17.11 s on runner `2.28.24.66` (job `qa-invariants-38c23b-21281-1792700732`).
- The corrected on-map escape viewpoints pass: **45/45 high, 23/23 low** admitted and reaching their authored street/cluster homes, runner `2.28.24.66`, job `qa-invariants-38c23b-98415-1792700403`, **16.79 s**. A final frozen-suite rerun and the Mac quiet-run comparison are pending. Raw logs and JSON live under `test-results/qa-invariants/`.

Earlier provisional failures were corrected in the test fixtures: a stale bike dismount point, comparison against a buried lower slab, a clock-only L3 wave dispatch, an unparked convoy in the L4 alarm fixture, and premature/overlong load waits. Those discarded observations are not presented as game bugs.

## Cheap 13g reproduction

`npx tsx tools/qa/probe-baseline.ts lane/batch13g` exited **1 / red** against `769d9f8ce07ca3a6dc0db244a8c33122bd12dc22`: **299 tank poses, 26 distinct route/stop conflicts**. It reads the historical layout from Git and first verifies byte-identical tank authoring, dependent data, physics shapes and scripted controller source. [Exact source hashes and intersections](historical-tank-13g.json). This is a historical tank component probe, not a full 13g campaign/render run. No baseline worktree or second build was created.

## Validation and limits

- Typecheck and lint pass. Build passes.
- Unit suite: **1,971 passed / 2 existing failures**: `tests/unit/static.test.ts` sees the existing extra `preview/lighting-spike.html`; `tests/unit/tools/remote-cache-gc.test.ts` fails its Linux-shell cleanup expectation on this Mac. Neither test nor its implementation was changed.
- Rendering is one headless Chromium browser, one worker, native Metal/WebGPU, private ports 4191/4192, `E2E_UNITS=1`, admission timeout 3600 s, through quiet-run and the reentrant e2e-lock wrapper. No deploy, merge into another lane, or game fix was performed.
- These fixtures measure the invariant at authored scene/phase starts. They do not replace the visual A/B and PO checks for animation aesthetics, corpse appearance or combat balance.
