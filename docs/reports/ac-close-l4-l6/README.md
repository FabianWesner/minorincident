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
| E23-AC19 | Pending peak matrix and retention. | Both backends/tiers/zoom limits, original frame/counter/draw-regression budgets, warmed heap/GPU growth ≤10%. |
| E24-AC15 | Pending pixel matrix; latest broad verification still fails the old body-box eye sampler. | Player contrast ≥3:1, body-isolated brightest red eyes and tier-correct hero shadow at both spots across backends/tiers/zooms. |
| E24-AC18 | Pending scored review and phone overlap proof. | Seven-photo route, corrected retreat composition, calm/failure/retreat/night A/D/G scores ≥7 and phone gate prompt clear of HUD. |
| E24-AC19 | Authorized clarification applied; execution pending. | High ≥40 / low 30 infected, ≥25 moving survivors, native tier budgets and ≤50 ms transitions; warmed retention ≤10%. |

## Execution record

The first remote attempt was rejected by the workspace network sandbox before any job started (SSH `Operation not permitted`, wrapper exit 69). Network access was subsequently enabled; the selected current-tree unit/level run was launched again on runner `2.31.10.108`. Results are pending and no pass is claimed.

Opened historical images during triage: L4 boundary-refuge high war and low collapse; L6 pickup/closed-gate backend/tier sheet; L5 vehicle-travel five-person group. They expose the intended compositions but do not close the current-tree matrix or scored review.
