# r15-qafix — final verification in progress

Base: `121696a6`. No browser, deploy or push. The brief delegates visual rechecks to Browser QA.

## Fixes

| Requirement | Commit | Change and evidence |
| --- | --- | --- |
| Runner FIFO | `8882ae9d` | Release the Mac ticket after confirmed detached launch. The host's `exec.sh` FIFO owns slot waiting. The regression executes `run.sh` against a simulated busy host and requires ticket release before log following. |
| APC cab | `a808adfe` | A sloped windshield joins the armored nose and opaque roof; the old front shell is cut behind the glazing. [Geometry proof](apc-geometry.json): nine clear seated-eye sightlines at the gameplay angle and both QA front angles; the old roof blocks all nine. Roof opacity is 1. Asset and cab-code hashes are retained. This is CPU geometry evidence, not visual approval. |
| Moving headlight shadows | `7202f5d8` | An explicit active-driven-headlight flag keeps the source eligible when the follow focus leaves its bright pool. Off lamps remain ineligible and stronger practicals can win. Shared render assertions cover outside-pool selection and power off. |
| G-24 | `6c0b33fd` | Restrict the distance exception to shielded riots and the pursuing Mega. Alpha's exemption from the crowd cap no longer bypasses its 15 m/damaged eligibility rule. The original controlled fixture is unchanged. Added production assertions for healthy/damaged distant Alphas and ordinary infected. |
| L10 charge completion | `492021c2` | The raised mounted gun aims down along the player's yaw, with XYZ cover checks, matching barrel pitch and tracer slope. A ground target formerly retained all 100 HP; the regression now kills it while a tall-wall control retains 100 HP. |

## Cause and contracts

E32's charge clock was working. Height-aware hitscan rays made the raised minigun's horizontal shots pass above street enemies, leaving the courier unable to defend the charge. Installed-checkpoint diagnostics before the final bar-only correction completed the 3,600 ticks at both qualities with zero deaths and recorded minigun hits. The prior full native run then completed low/high in 1,290.583/1,442.533 simulated seconds, with 0/4 deaths and one cure release each. Those receipts use source `6b940d0c…`, before the final bar-only correction; the final-source rerun is pending below.

E32 §5.7 explicitly resets charge on death to the pre-activation checkpoint. An earlier charge-persistence proposal was removed. The normal checkpoint reset and native input policy remain in place.

G-24 exposed a regression from `935c0138` (the L4 healthy-riot range fix): it reused the broader `mandatoryBar` crowd-cap helper in eligibility. E07 and the accepted G-24 review require Alpha bars only at ≤15 m or after damage. An initial fixture-exception proposal was removed; the final fix preserves that original criterion and the riot/Mega exceptions.

## Verification

- `python3 tools/remote/check.py --unit`: PASS, 13 passed, 3 worker checks skipped by `--unit`.
- `node --import tsx/esm tools/qa/r15-apc-geometry.ts`: PASS, 9/9 post-change sightlines; opaque roof.
- Prior remote `npm run verify -- E32`: PASS, typecheck/lint/all 27 files, 106 tests passed and one macOS-only test skipped; budget intact. This precedes the final G-24 source correction.
- Final proof-tool typecheck/lint: PASS remotely.
- Final source: `115f672aaa058f298b9c4a4477360000f354bfe3cb4ebe4e4dc1d1562b69f6c3`.
- Final-source shared-runner gate: typecheck/lint passed; 105 tests passed, one macOS test skipped, and the unchanged A* test exceeded its 30 s deadline under contention. The failed receipt is retained as `verification/epic-E32-contention.json`.
- Final jobs are live in the remote FIFO: an isolated `bash tools/remote/timing-isolated.sh --whole-run npm run verify -- E32` and a separate `npm run qa:accept -- --level L10 --policy complete --skip-browser`. Each creates a private Git snapshot first. Native completion must be read separately from unrelated whole-epic acceptance rows.

The runner sync cache is commit-less. Initial diagnostics/gates that called `git rev-parse HEAD` failed; verification now creates the private snapshot before invoking Git-dependent tools. One copied stale cache index lock was removed only after confirming no process used that cache. These infrastructure attempts are not accepted as gameplay results.

## Browser QA needed

- Physically enter the APC and review `detail-apc-front` and `detail-military-apc` from `docs/reports/qa-browser/vehicle-detail.ts`. Confirm seated-driver readability through glazing, closed roof, posts/sill and complete body panels at gameplay zoom and all LODs.
- Repeat `isolated-headlights` from the shadow capture/audit at low/high on both native backends. Confirm sustained moving-APC selection, actual actor-shadow direction, one refreshed map, and stronger-lamp/power-off transitions.
- Review the raised L10 gun's pitched firing/tracers, enemy stair approach, and physical charge/Mega progression. Death must still restore the pre-activation attempt.
- Repeat the original five-state G-24 rendered bar matrix at both qualities. Native eligibility alone is not pixel approval.

Full L10 low/high final-source completion, final controlled G-24 and checkpoint/control receipts, and the final report commit remain open. Heavy checks run on the remote pool. No browser acceptance is claimed.

## Current runner admission blocker

Both final jobs remain live and queued. The FIFO head (`r12-l4truck`, PID 84423) has stayed in its admission loop for over 19 minutes while the pool reports free hosts. The same helper can select a host when invoked from this lane’s current execution context. The owning lane has been notified to inspect/restart its launcher context; this lane has not removed another job’s ticket or restarted its process. Native session 9769 / PID 16195 and isolated-gate session 86537 / PID 16295 must be polled as existing jobs, not relaunched.
