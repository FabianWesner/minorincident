# r15-qafix — fixes and verification

Base: `121696a6`. Requested fixes and non-browser verification are complete. No browser, deploy or push. The brief delegates visual rechecks to Browser QA.

## Fixes

| Requirement | Commit | Change and evidence |
| --- | --- | --- |
| Runner FIFO | `8882ae9d` | Release the Mac ticket after confirmed detached launch. The host's `exec.sh` FIFO owns slot waiting. The regression executes `run.sh` against a simulated busy host and requires ticket release before log following. |
| FIFO admission follow-up | `8489b207` | Normalize doubled command separators before enqueueing; reject an empty command. A head that cannot select for 60 s yields to the next ticket without losing its retry or original wait time. Host probes time out after 45 s; successful probes recheck turn ownership. |
| APC cab | `a808adfe` | A sloped windshield joins the armored nose and opaque roof; the old front shell is cut behind the glazing. [Geometry proof](apc-geometry.json): nine clear seated-eye sightlines at the gameplay angle and both QA front angles; the old roof blocks all nine. Roof opacity is 1. Asset and cab-code hashes are retained. This is CPU geometry evidence, not visual approval. |
| Moving headlight shadows | `7202f5d8` | An explicit active-driven-headlight flag keeps the source eligible when the follow focus leaves its bright pool. Off lamps remain ineligible and stronger practicals can win. Shared render assertions cover outside-pool selection and power off. |
| G-24 | `6c0b33fd` | Restrict the distance exception to shielded riots and the pursuing Mega. Alpha's exemption from the crowd cap no longer bypasses its 15 m/damaged eligibility rule. The original controlled fixture is unchanged. Added production assertions for healthy/damaged distant Alphas and ordinary infected. |
| L10 charge completion | `492021c2` | The raised mounted gun aims down along the player's yaw, with XYZ cover checks, matching barrel pitch and tracer slope. A ground target formerly retained all 100 HP; the regression now kills it while a tall-wall control retains 100 HP. |
| Charge QA accounting | `25fc5317` | Compare increments with all eligible ticks across death retries; retain the 3,600 maximum and zero-invalid-increment checks. Eight real-receipt and corrupted-counter controls distinguish valid retries from bad clocks. |

## Cause and contracts

E32's charge clock was working. Height-aware hitscan rays made the raised minigun's horizontal shots pass above street enemies, leaving the courier unable to defend the charge. Earlier [installed-checkpoint diagnostics](charge/charge-diagnostic.json) record real gun hits and 3,600 charge ticks at both qualities. The final full native runs complete the entire route through hold, Mega, cure release, epilogue and credits:

| Quality | Simulated seconds | Deaths | Cure releases |
| --- | ---: | ---: | ---: |
| Low | 1,290.583 | 0 | 1 |
| High | 1,442.533 | 4 | 1 |

The high run has 10,620 eligible ticks and exactly 10,620 increments across all attempts, a maximum charge of 3,600, and zero invalid increments. The QA evaluator formerly required the whole-run totals to equal one attempt's 3,600 ticks. The correction accepts valid retries while rejecting missed/extra increments, invalid increments, over-cap charge and insufficient eligible time. It changes no measured receipt, simulation, observer or completion policy.

E32 §5.7 explicitly resets charge on death to the pre-activation checkpoint. An earlier charge-persistence proposal was removed. The normal checkpoint reset and native input policy remain in place.

G-24 exposed a regression from `935c0138` (the L4 healthy-riot range fix): it reused the broader `mandatoryBar` crowd-cap helper in eligibility. E07 and the accepted G-24 review require Alpha bars only at ≤15 m or after damage. An initial fixture-exception proposal was removed; the final fix preserves that original criterion and the riot/Mega exceptions.

## Verification

Final game source: `115f672aaa058f298b9c4a4477360000f354bfe3cb4ebe4e4dc1d1562b69f6c3`. See [verification summary](verification-summary.json) and the [native report](native/L10.json).

- Runner regression: 16 passed; 3 remote-worker checks skipped by `--unit`. [Hashed receipt](verification/scheduler.json). The live replacement (PID 53248) also released its Mac ticket while remote validation was still running on runner-3, slot 1.
- APC CPU geometry: 9/9 clear seated-eye sightlines, opaque roof; [hashed evidence](apc-geometry.json). This is not rendered approval.
- Final native route: both qualities complete, no receipt errors; **32/32 controlled fixture clauses** (including original G-24 at each quality), **54/54 checkpoint clauses**. Both observed/control state hashes are identical.
- Isolated remote `npm run verify -- E32`: **PASS**. Typecheck and lint pass; 27 test files, 106 tests passed, one macOS-only skip. Test command 84.775 s against the unchanged 240 s budget; A* passed in 27.080 s against its unchanged 30 s timeout. Collection remains 150/150.
- Latest QA evaluator typecheck/lint: **PASS** remotely. The cached report rebuild marks both charge-counter clauses **PASS**, with all six canonical measured receipts retaining their [original hashes](canonical-receipt-hashes.json). All eight [counter controls](charge-verdict-proof.json) pass; [rebuild receipt](verification/reevaluation.json).
- Specs, mission death/checkpoint behavior, native bot, original controlled fixtures and dependency files are unchanged from base.

### Remaining whole-epic acceptance findings

`qa:accept --level L10 --policy complete --skip-browser` exits 1 despite both native completions. The report retains separate fresh findings: G-22's low first attack is 21.317 s against 20 s; L10-03 has a 19-member corridor group against 20–35 and a high-quality dog peak of 6 against 3–5. Imported composition evidence is stale. Other historical failures with current status `NOT CHECKED` and uncaptured browser clauses also remain. This lane does not claim whole-epic or browser acceptance.

### Runner verification attempts

The sync cache has no commit initially; Git-dependent checks now receive a private snapshot before execution. A stale copied cache lock was removed after confirming no process used it. An earlier shared-runner gate passed typecheck/lint but timed out in the unchanged A* test under contention; [failed receipt](verification/epic-E32-contention.json) is retained. The subsequent isolated gate passed with the original deadlines and test budget.

An older FIFO head (`r12-l4truck`, PID 84423) stalled admission while hosts were free. After owner notification and replacement, both existing final-game handles advanced and completed without relaunch. This lane did not remove another job's tickets or restart its processes. The pre-follow-up QA-only launcher exited before sync after its shell script was edited in place; its replacement uses committed `8489b207`. No native simulation was rerun or lost in that attempt.

## Browser QA needed

- Physically enter the APC and review `detail-apc-front.jpg` and `detail-vehicle.military-apc.jpg` from `docs/reports/qa-browser/vehicle-detail.ts`. Confirm seated-driver readability through glazing, closed roof, posts/sill and complete body panels at gameplay zoom and all LODs.
- Repeat `isolated-headlights` from the shadow capture/audit at low/high on both native backends. Capture ticks 21, 51, 120 and a longer drive. Confirm sustained moving-APC selection, actual actor-shadow direction, one refreshed map, and stronger-lamp/power-off transitions.
- Review the raised L10 gun's pitched firing/tracers, enemy stair approach, and physical charge/Mega progression. Death must still restore the pre-activation attempt.
- Repeat the original five-state G-24 rendered bar matrix at both qualities. Include the healthy riot at 16 m control. Native eligibility alone is not pixel approval.
