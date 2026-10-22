# E22–E24 acceptance closure — 2026-10-22

Starting source: `769d9f8ce`. The ten partial criteria in the 2026-10-18 sweep remain unaccepted until the evidence below proves their full scope. Historical green runs do not supersede later failures. All browser work is headless, one worker/session, on ports 4081/4082; native timing uses the shared quiet wrapper in reservations of at most twenty minutes. The local browser remains reserved for the QA lane until 09:15 UTC.

## Authorized specification clarification

The orchestrator explicitly authorized the E24-AC19 rewrite on 2026-10-22: the tunnel stress fixture must have **at least 40 infected on high and the low-tier cap of 30 on low**, each within its own tier's E18 budgets. The criterion is marked `CLARIFIED 2026-10-22 (orchestrator)`. This resolves the conflict between the old literal 40-infected requirement on both tiers and E24-AC13's low cap of 30. Survivor count, effects, quality budgets and the 50 ms breach/abandon limit are retained. `tests/perf/l6-budgets.spec.ts` already asserts these distinct population floors; fresh execution is required before acceptance.

## Criterion ledger

| Criterion | Current assessment | Required closure evidence |
| --- | --- | --- |
| E22-AC04 | Pending current proof; the corrected actual-bus probe failed all 17 configurations on Oct 16. | Corrected-bus smoothness at the unchanged 0.6 px RMS limit, plus ride/control mechanics. |
| E22-AC12 | Pending inherited visual proof. | Four Alpha moves with boundary, repeat/cooldown and restore; shared phone/occlusion bars; existing level mechanics retained. |
| E22-AC19 | Pending scored review. | Safe/war/tank/collapse A/D/G/H review, each ≥7, all must items, no P0/P1. |
| E22-AC20 | Pending current measurement; historical low turn maximum 60.7 ms exceeds literal 50 ms. | Native peak/caps and all specified beat maxima ≤50 ms, both tiers. |
| E23-AC17 | Pending current route; the Oct 15 pass predates the Oct 16 Sam→Mia failure. | Ordinary cellar→Sam→Mia→all five→shutter route, photos and zero console errors. |
| E23-AC18 | Pending scored review. | All four recognizable safe/fallen pairs, vulnerable five-person group and sunset, each ≥7, no P0/P1. |
| E23-AC19 | Newer shared fixes pass the historical three-load L5 check (+3.29% high / +5.18% low heap); fresh five-load proof remains pending. | Both backends/tiers/zoom limits, original frame/counter/draw-regression budgets, warmed heap/GPU growth ≤10%. |
| E24-AC15 | Pending pixel matrix; latest broad verification still fails the old body-box eye sampler. | Player contrast ≥3:1, body-isolated brightest red eyes and tier-correct hero shadow at both spots across backends/tiers/zooms. |
| E24-AC18 | Pending scored review and phone overlap proof. | Seven-photo route, corrected retreat composition, calm/failure/retreat/night A/D/G scores ≥7 and phone gate prompt clear of HUD. |
| E24-AC19 | Authorized clarification applied; execution pending. | High ≥40 / low 30 infected, ≥25 moving survivors, native tier budgets and ≤50 ms transitions; warmed retention ≤10%. |

## Execution record

The first remote attempt was rejected by the workspace network sandbox before any job started (SSH `Operation not permitted`, wrapper exit 69). Network access was subsequently enabled; the selected current-tree unit/level run was launched again on runner `2.31.10.108`. Results are pending and no pass is claimed.

Opened historical images during triage: L4 boundary-refuge high war and low collapse; L6 pickup/closed-gate backend/tier sheet; L5 vehicle-travel five-person group. They expose the intended compositions but do not close the current-tree matrix or scored review.

## Acceptance instrumentation

- `tests/e2e/acceptance/l4-alpha.spec.ts` retains the four named Scene Lab fixtures and captures before activation, impact/expiry, saved/restored cooldown and the second activation. It checks exact inside/outside charge/slam/roar boundaries, the throw pickup boundary, rejection one tick before eligibility and the next activation exactly at cooldown expiry. It preserves the same thrown corpse identity. Shared wall/resistance/damage tests remain required.
- `tests/e2e/acceptance/l6-readability.spec.ts` adds the two-spot backend/tier/zoom matrix. A with/without-crowd image pair isolates actual infected pixels from unrelated lamps and survivor bars. The **whole-body** brightest pixel still must meet the original red margin (60) and hue (330–20°) and lie at the projected emitted-eye geometry; player contrast stays ≥3:1. The old default test remains present for comparison until native evidence identifies its failed pixel.
- `tests/e2e/acceptance/l6-phone-panel.spec.ts` uses real touch contexts, both phone orientations, all three player zooms and four gate states. It asserts zero overlap with visible objective, subtitle/story, vitals, map, weapon-rack and action-button rectangles as well as the original viewport bounds.
- The existing lifecycle fixture now uses five settled loads for L5/L6/L7, begins each mission before measuring deferred residency, checks actual backend/tier and preserves the unchanged 10% heap/geometry/texture limit. The L5/L6 budget fixtures can select actual WebGPU as well as WebGL2; L6 also asserts ≥25 moving survivors and active emergency/headlamp state.
- The L7-entry browser fixture previously teleported only the courier to its corridor checkpoint while leaving the cohort at Northgate. Production correctly requires every living follower within 18 m. The fixture now stages the cohort as the existing unit checkpoint test does, with an explicit distance assertion; all checkpoint, death/restore, roster and arsenal assertions are retained.
- `MI_VERIFY_REMOTE_E2E=1` now splits E24 functional checks onto the runner as it already does for E23. Both use one local worker. Native visual/input/photo and quiet performance stages remain explicit.

Typecheck and lint have passed during preparation. These new browser checks are not yet reported as executed or accepted.
