# batch13j gate repair (in progress)

Base: `218f12ae5`; implementation branch: `lane/gate-13j` (fast-forwarded from the batch at the orchestrator's request). No deploy or merge of `lane/load-stalls`.

## Triage

The remote starting sweep reproduced 379 accessory offenders, 12 unsupported sitters, L4 war/collapse shortfalls, and the L1/L2/L6 wave-census failures. The first remote sync included the objective visibility fix, so its 21/27 result is not an unmodified seven-red baseline; the original marker suppression is independently present in the batch and PROD source.

| Item | Classification and cause | Repair / evidence |
| --- | --- | --- |
| Objectives | Real, also in PROD: `!storyShot` suppresses the current waypoint for camera pull-backs. | Keep the waypoint during a camera shot. Actual mission activation and 120-tick marker probes pass. |
| Seats | Real, also in PROD: L6 assigns `npc-sit` at floor positions without authored seats. | Add shelter benches and bind the sitting schedule to each bench's hip anchor and lift. Both quality tiers pass the complete 90-second L1–L10 seat sweep. |
| L1 exits | Real, also in PROD: the rear lab-staff row starts behind the seal and cannot advance through the inside face of the open doorway. | Give the emerging row a bounded open-door lane, including its short indoor approach; remove it when the walk ends. The census improves from 3/5 to 5/5 on both tiers. |
| L6 entries | Real, also in PROD: the north entries use the south entries' negative-Z offset and wander into the void outside the tunnel. | Emit both sides inward, then steer the entry toward its fixed tunnel mouth. All six entry quotas reach the tunnel on both tiers. |
| Accessories | Mixed: reworked sun/bucket hat dimensions and glasses-clearance expectations are stale; missing skull skin tags on five aftermath models are real. | Keep the 10% manifest tolerance, 2 mm numerical floor and existing brim limits. Measure the reworked GLBs and base spectacle geometry; recognize the author's fixed 8% soot tint and the shipped survivor group's quantized local skin colours when recovering skin ownership. The complete accessory matrix passes (candidate4-census.log); the separate hat-brim regression also passes. |
| L2 ambush | Mixed, also in PROD. Real: a cap-blocked arrival becomes `-1` permanently; later escape batches can take its remaining slots. The AI also abandons a long street detour at 10 s and lets a herd heading erase its directed destination. Fixture assumptions were stale: it skipped arrival/disembark, started damage isolation late, and let immortal fleeing humans intercept the wave outside the market. | Preserve/retry pending identities, reserve the finite alarm quota against later arrivals, allow the northern door 30 s to route around its block, and retain directed approaches until their own deadlines (visible victims still take priority). The fixture uses the real arrival lifecycle, observes from the first staggered spawn, and restricts its target query to the unchanged measured market rectangle. All 24 high / 12 low arrivals pass; the new approach regression tests and both L4 alarm arrival tests pass (candidate8-market-targets.log). |
| L4 war/collapse | Real investigation continues: a collapse mouth 29.7 m from the stationary courier never passes the 30 m rule; some war arrivals stop outside the hold area. | Keep every authored quota and the existing arrival criterion. Try alternative authored mouths without changing the no-pop rule; inspect actual moving targets and goals for the remaining arrivals. |
| L4 collapse | Real investigation continues: finishing first-down bodies removes close pressure before they recover; simply removing finishing still leaves 14/20 soldiers at the third beat and stalls replenishment. | Retain #118's flowing waves and cap; no soldier power reduction, scripted casualties, or relaxed casualty assertion. Candidate recovery/Alpha handling is under test. |

## PROD check

`evidence/prod-source-audit.json` records `git show 73bce8bc5:<path>` blob identities and the corresponding faulty code for each real invariant issue. This is a static source audit, not a claim that a PROD test suite was run. These are existing defects as well as merged regressions. The hat authoring changed in `lane/hats-rework`; old source dimensions cannot be used as the new GLBs' scale contract.

## Load-time meaning

The Mac invariant starts immediately before the real level-menu click, activates Begin immediately, and stops after two drawn gameplay RAFs in mission phase `playing`. Each candidate/PROD observation uses a fresh context, WebGPU and low quality. The limit is `PROD + min(1000 ms, PROD * 0.1)`: a regression delta, not an acceptable absolute loading-time budget. The tracked earlier L8 receipt was 24.662 s candidate versus 23.145 s PROD and failed that delta. The orchestrator confirms that the merge lane's “50 s” receipt is no longer available after worktree removal, and likely covered both paired loads. It is not evidence of one 50-second load. A fresh paired run after the quiet window will provide the individual measurements.

Read-only context from `lane/load-stalls` confirms a quiet L8 load around 24.49 s (17.71 s assembly, 6.18 s warm-up), and a separate unchanged 6.0 s worst-load acceptance budget. That lane owns the loading fixes and is not merged here. Final `qa:invariants` measurements will be recorded separately.

## Validation

Pending final remote unit/level suite, complete `qa:invariants`, production build and one-worker headless smoke. Browser work uses 4251/4252, one browser through the shared admission wrappers; no Mac browser is started during the load-stalls quiet window (until approximately 01:05 UTC).
