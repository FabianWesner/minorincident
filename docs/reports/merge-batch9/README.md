# merge-batch9

**Incomplete: the L6 zero-death / ≥60% real-input rescue gate is not closed.**
Both requested lanes are merged on `lane/merge-batch9`; no merge into main or deployment was performed.
The L6 navigation fix, touch control fixes and seven traceability mappings are committed.
Final typecheck, lint and production build pass; the static traceability audit has no missing tags.
The full remote suite did not finish, and browser admission exceeded the binding 30-minute cap.
Fresh WebGPU/phone sheets, final L6 proof, browser deploy gate and native E18 approval remain unmeasured.

## Changes

- `598c7fb25`: merge `lane/l6-exit-stall` at `ba35f4bee`. Reviewed the four WIP source edits: the shared exit approach, per-walker platform alignment, completion-bot route and L6 physical-input planner are real route/test-harness fixes. No source debugging flags or immunity were retained. The merge preserves the full-input zero-death, ≥60%, gate, seven-photo, rejoined-straggler and exact L7 carryover assertions. Conflicts retain both lanes' catalog coverage; the duplicated L7 graph branch was subsequently removed to restore typecheck.
- `4cc67eca8`: merge `lane/ui-night` at `42e23cb38`.
- `c94e343d6`: L6 actor navigation now respects the authored excluded areas. The pre-fix physical run stalled near `(90, 10.79)`, outside the tunnel, while the cohort moved ahead. `LevelSixSubway.prepare()` applies the room mask to the shared navigation grid, including L6 Scene Lab fixtures. Added a first-gate route regression and `qa-l6-gate-route` / `qa-l6-shelter-reveal` to the default matrix. **The post-fix rescue outcome is unmeasured.**
- `cf94b9b21`: real tests and matching traceability tags; production Mega arrival now explicitly checks the PO's ~140 s target while retaining the measured ~143 s assertions. The separate 60 m close-start assault fixture retains its existing 10–40 s assertion and identifies its different setup.
- `596f84f61`: phone ACTION eligibility now includes the mounted minigun and retained weapon pickups. Held touch fire is sampled while mounted, and the nearby phone hint says “Tap ACTION”. The new phone test exposed the disabled-button defect; the fix has not received a browser rerun. Corrected the new L7 test's pause handling after its actual L8 handover.

No spec, L5 enemy/difficulty, test threshold, rescue assertion or E18 budget was weakened. No change to `src/assets/staticCollision.ts` or the protected reference trees is present.

## Traceability

The [static audit](evidence/traceability-static.json) executes the same active-epic/tag predicate as the Vitest guard: current missing tags **0**, archived `6e4e37634` missing tags **7**. This is a static check, not a claimed Vitest guard pass.

| Criterion | Real coverage |
| --- | --- |
| E29-AC01 | Existing campaign graph and zero/35-person bus tests |
| E29-AC14 | New night-preset contract and production rocket/horde contrast tests |
| E29-AC17 | New physical keyboard/mouse route and touch pickup/corridor fixtures |
| E29-AC18 | New fixed-camera W5/W6 pairs at the four authored Fairhaven anchors; vision approval remains pending |
| E29-AC20 | Existing native peak-horde frame probe, added existing-spec 50 ms hitch assertion, new accessibility/resource lifecycle test |
| E31-AC18 | Existing real route/crash/crawl/axe input, HUD checks and paired captures; fresh vision approval remains pending |
| E32-AC29 | Existing weapon/cure/charge/release/epilogue input tests plus new desktop/touch mount/overheat/cooldown/dismount test |

Coverage tags do not establish that every part of these acceptance criteria is approved. In particular, no fresh visual-pair review or final touch pass is claimed.

## Validation and every observed red

[Final typecheck](evidence/typecheck-final.txt), [lint](evidence/lint-final.txt) and [build](evidence/build-final.txt): exit 0.

The [first remote sweep](evidence/after-l6.txt) tested the L6-only integration snapshot, before the navigation/touch fixes. Its observed L6 complete and newbie tests passed, as did both existing production Mega-arrival tests ([extract](evidence/l6-node-observed.txt)). It lost its connection before the final aggregate/error diagnostics and exited 255. The post-ui snapshots were superseded before runner admission as touch fixes were added; the [final full-suite attempt](evidence/node-final-attempt.txt) cannot select a runner. No final all-suite pass is claimed.

The eight observed remote failures remain unresolved until isolated reruns. The [final-source isolated attempt](evidence/node-isolated-attempt.txt), including all eight failing files, was also blocked before runner admission. Timings below are test durations, not measured p95 values. [Machine-readable list](evidence/node-failures-observed.json).

| Red test | Observed result | Also red on main? |
| --- | --- | --- |
| T-E07-11-zoo-s1-200 | 4 ms high-tier performance gate failed | Unknown; control could not run |
| T-E07-11-alpha-200 | 4 ms high-tier performance gate failed | Unknown; control could not run |
| T-E07-11-alpha-physical-200 | 4 ms high-tier performance gate failed | Unknown; control could not run |
| T-E07-11-zoo-s2-200 | 4 ms high-tier performance gate failed | Unknown; control could not run |
| T-E07-11-zoo-s3-200 | 4 ms high-tier performance gate failed | Unknown; control could not run |
| T-E32-11-perf-200 | E18 Mega performance gate failed | Unknown; control could not run |
| T-E17-02b | Production asset contracts failed after 300.539 s; likely load timeout, final diagnostics unavailable | Unknown; isolated control blocked |
| T-E23-12-kill PO #37 | Failed after 47.937 s; final assertion/timeout diagnostics unavailable | Unknown; isolated control blocked; no L5 tuning changed |

Browser outcomes are **pre-fix observations**, with final reruns unmeasured:

| Red test | Observed result and disposition | Also red on main? |
| --- | --- | --- |
| T-E24-17 | L6-only integration remained `playing`, stalled before the first gate. Authored-room navigation fix added; ≥60%/zero-death rerun did not start. | Supplied batch-8 report says yes, with a different result/death/rescue failure; not freshly rerun here |
| T-E24-15 shelter-fails | Courier mask **1,971 pixels**, contrast **3.923:1** passed; the failing `>=60` check was **eye red dominance**, sampled as white health-bar pixels. Eye sampling now excludes actual overlay-bar rectangles; all numeric thresholds remain. Final rerun did not start. | Supplied report says red; this run does not reproduce an invisible courier |
| T-E32-29-minigun touch | ACTION disabled beside an otherwise mountable gun. Eligibility and held-fire fixes added; final touch result unmeasured. | Same omitted eligibility code exists on main; browser control unmeasured |
| T-E29-17 keyboard/mouse | Physically reached L8, then the new test stepped the newly loaded unpaused level. Harness corrected; no passing rerun. The recorded route also lost all **24 followers**, so it does not approve the follower escape sequence. | New test; unchanged-main control unmeasured |
| T-E29-17-touch | ACTION disabled at the rocket pickup. Eligibility fixed; final result unmeasured. | Same omitted retained-pickup eligibility exists on main; browser control unmeasured |

The new desktop minigun test passed in 12.6 s before the touch fix. The batch timed out before the L7 contrast/pair tests completed. Raw [L6 pre-fix](evidence/l6-pre-fix-browser.txt) and [traceability pre-touch](evidence/trace-browser-pre-touch.txt) logs are retained. No failures beyond those observed in the incomplete logs can be enumerated reliably.

The prepared main source/layout control is exactly `6e4e37634`; its production build succeeded. [Its isolated test attempt](evidence/main-isolated-attempt.txt) failed before execution because runner-pool DNS resolution failed. Direct SSH recovery also fails locally with `No user exists for uid 501` ([log](evidence/runner-recovery.txt)). Therefore unknown main comparisons above are intentionally not represented as passes or confirmed baseline failures.

## Browser fairness, gate and QA limitations

The [fairness record](evidence/fairness.json) retains a **1,802.29 s** L6/UI batch with no `Running` line and no tests started. The earlier traceability batch also queued before running. Once the binding 30-minute admission cap was exceeded, no additional browser, matrix, gate or quiet-run reservation was requested. No quiet reservation was held. Observed Mac load was **26.61 / 31.80 / 29.44**; native timing is unmeasured.

The supplied orchestrator gate script overrides the requested ports with 3397/3393. A [prepared copy](evidence/gate-browser.sh) and [two-port-only diff](evidence/gate-browser-ports.diff) use 3401/3402. **The script was not executed after the fairness stop.** Its default Scene Lab matrix expands to **1,080 views**. Smoke, that full matrix and the deploy browser battery therefore have no final result.

Final high/low × zoom 1/0.5 × WebGL/WebGPU QA is incomplete. Required ui-night WebGPU and phone-low zoom 0.5/1/1.5 captures are unmeasured, as are final eye/panel/weather/L6 checks and native E18 budgets. `ui-night-*` and both new L6 scenes are in the matrix catalog, ready for the next admitted run. No performance approval or epic completion is claimed.

## Images actually opened

- [L6 shelter, pre-fix integration](evidence/captures/l6-pre-fix-shelter-readability.png) and its [ID mask](evidence/captures/l6-pre-fix-shelter-mask.png): the courier is visibly lit near the ticket equipment; surrounding people are dark and health-bar borders enter the eye sample rectangles. The numerical courier contrast passes. This is diagnostic evidence, not final E24 approval.
- [Desktop minigun](evidence/captures/minigun-desktop-locked.png): the courier remains visible on the raised gun deck; the red OVERHEATED 100% bar and subtitle are legible. The passing test establishes keyboard mounting, lockout, cooling and rocket dismount in this fixture.
- [L7 night exit](evidence/captures/l7-night-exit.png): the courier's red shirt/teal backpack and the crowded yellow/blue-clothed cohort read against the purple-dark exit. [Horde frame](evidence/captures/l7-horde-flash.png) is washed by a rocket flash and cannot establish night contrast.
- Opened inherited ui-night [WebGL high / zoom 1](../ui-night/review-webgl-high-z1.jpg) and [low / zoom 0.5](../ui-night/review-webgl-low-z0.5.jpg) sheets: prompts remain within the top edge; crowd clothing has filled colored surfaces; warm facade/car pools, fog, rain and snow remain visible. These are the lane's earlier captures, explicitly not fresh GPU/phone proof or a final source-matched matrix review.

## Handoff

Recover or clean up this job's detached runner directories if they survive on `94.130.181.173`: `/srv/mi/jobs/merge-batch9-620a80-68324-1792266600` (first sweep), `/srv/mi/jobs/merge-batch9-620a80-13131-1792267869` and `/srv/mi/jobs/merge-batch9-620a80-31302-1792268224` (superseded queued snapshots), plus their `.run` directories. The normal runner wrapper attempted termination; successful remote cleanup could not be confirmed after local SSH identity failure.

After runner/browser availability is restored in a new admitted batch: run the final full remote suite and isolated red/control files, then T-E24-17 without changing its assertions, the touch regressions, both-backend/phone ui-night matrices and the port-corrected deploy gate. Run native budgets through one bounded quiet reservation, release it within 20 minutes and respect the admission cap. Keep the L6 rescue gate open until the actual zero-death / ≥60% result and captures exist.
