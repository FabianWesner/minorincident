# Gate record

**Overall: RED — the requested full green gate is not yet established.** The implementation, visual matrix and functional results below must not be mistaken for E18 acceptance. Main `350ac1d1d` is merged; retained physical/render source is `7ef492f7f` (static callback extraction and two-policy cell-bound cache); L2 input recovery is committed as `590b667e4` unless a later result explicitly names a source. No budget/assertion has been relaxed.

## Functional and build checks

| Check | Result and provenance |
| --- | --- |
| Typecheck, lint, fresh production build | Fresh production build (7.83 s), typecheck and lint pass on590b667e4; no local Vitest sweep. |
| Full unit and functional sim on retained physical source | `7ef492f7f`: **1528 unit passed, 0 failed, 7 skipped; 930 functional sim passed, 0 failed**. `590b667e4` exact-source repeat: **1530 unit passed, 0 failed, 7 skipped;930 functional sim passed, 0 failed**, reserved runner1,585 s total. |
| Full unit + sim on `f24ebb6e2` | 2628 passed, 17 failed, 7 skipped. Failures were 15 performance timing assertions, one 300 s asset-validation timeout and one 30 s L9 handover timeout. No functional assertion failed. The L9 handover passes alone in 11.38 s; 37 further timing checks pass under a reserved runner. Zoo S2 remains red. |
| Final full levels on590b | **323 passed,0 failed,2 skipped**, all tests/levels, maxWorkers4, both runner3slots reserved;1925 s remote total. Standalone L6 complete/siege and frozen L5 intruder assertions pass unchanged. |
| Historical full levels before L2 recovery/jamb repair | 322 passed, one failed, two skipped. Only T20-17 L2 calm-checkpoint save failed; the ordinary input policy now collects an existing health pickup when needed. No save criterion changed. |
| L2 closure/timing/checkpoint + camera focus | 7 passed, 20 unselected. The old 0.715 m jamb gap is physically closed; unchanged closure assertions pass. |
| Scene Lab fixture loading | 14 passed. Inherited production district dimensions, safe initialization and reuse of living capped actors are covered. |
| Three known load timeouts in isolation | Final590b: asset/LOD validation **17/17**, maximum187.01 s <300 s; static typecheck/lint/build guard **1/1**,96.16 s <180 s; natural solid registry **5/5**, maximum64.95 s <180 s. Both runner2slots reserved; one file/worker at a time. Earlier e723 isolations are historical. |
| L6 siege | 9.8167 s ≤12 s; unchanged assertion passes. |
| L6 seed-1 complete | 264.4167 s ≤270 s, zero deaths, 27/29 rescued; unchanged assertion passes. Continuous campaign's inherited L6 run is a separate case (273.5 s), not evidence for the standalone 270 s criterion. |
| Encounter balance and L5 intruder | Unchanged assertions pass. The 82-check private experiment selection also passes encounter balance; experiments are not retained by implication. L5 zombie/Alpha tuning and all `src/data/` match main. |
| Ride camera | 17/17 passed, no flaky/skipped tests, `cd43c89b3`, 120.94 s. Both backends/tiers and every existing cadence, four wheels, sample-count and .6 px limit retained. |
| Final deploy browser selection | Fresh590b build; ran the unchanged94 tests as two47-test shards with one worker/unit per reservation, plus16 smoke tests. **94/94 deploy tests** across47+47 shards; **16/16 smoke**. No failures,flaky cases or skips;691.61 s+613.69 s shards,178.34 s smoke. One worker/unit; both reservations<18 min with a gap. |
| Graphics matrix | Fresh retained-source WebGL **90/90**,993.84 s. Requested core WebGL/WebGPU **18/18 each**, all24 zoom1/.5 sheets opened. Fresh WebGPU **90/90**,934.84 s; all180 refreshed rows pass. Older04c4 results remain historical. High/low × zoom1.5/1/.5. |

The level-wide committed-occupancy test checks every tick and stationary full audits across L1–L10. Targeted independent circle/static projection, moved/stationary guards, parked tanks, pooled identity, attached/passenger masks, special sweeps and capped admission regressions retain the 0.02 m bound. Scene Lab checks report zero collision failures/pending and their explicit 2 cm overlap limits pass. See the named compact JSON evidence, rather than inferring separation from projected pixels.

## E18 performance

Paired Node protocol: full living/visible populations; seed1;120 warmup +3600 measured ticks; three alternating main/changed trials; ratio of median p95 values. All paired trials are retained, including failures and rejected experiments. Specials run their unchanged fixtures; Zoo S2 uses720 total ticks with the first120 excluded (600 measured samples). The protocol/aggregate is never changed after observing a result.

| Measurement | Result |
| --- | --- |
| Latest retained-source reserved runner-1 pair | 100 actors .862246 →.877244 ms median p95, **+1.739%**, passes +3%. 200 actors1.684315 →1.423226 ms, **−15.501%**. Raw three-pair samples retained under `collision-s3-retained-final`. |
| Earlier retained-source Mac quiet pair | Source327:100 actors .231916 →.243292 ms, **+4.905%**, failed +3%;200 actors−15.070%. Final590b Mac quiet rerun failed immediate admission and is unmeasured; see `final-quiet-admission.json`. The Linux pass does not erase the historical failure. |
| Latest retained-source specials | **21/22 pass**, Zoo S2 **4.271856 ms >4 ms**. Separately the complete timing project passes196 checks, fails only Zoo S2 at **4.404702 ms**. No timing failure is waived. |
| Further isolated timing checks | **37/37 pass**: director, NPC quality/campaign L1–L5, L10 assault/corridor, chunk residency and L9 handover. |
| Native browser E18 on `04c4c4bbe` | 5 pass, four phone-frame failures, four expected skips. Native desktop, emulated L6 device simulations and high/low horde checks pass. |
| Phone base at 4× CPU throttle | L1 frame/sim p95 34.2/5.0 ms; L3 34.2/4.3; L4 34.9/4.1; L5 33.8/3.9. All simulation p95 values meet 6 ms; all frame p95 values exceed **33 ms**. |

Native browser metadata reports ANGLE Metal / Apple M4, actual WebGL, no other headless Chrome and no local Vitest at sample boundaries. Measurements used the quiet-run reservation. Main's earlier phone comparison was L1 31.9 ms, L3 approximately34 ms, L4 approximately34.6 ms, L5 33.4 ms; baseline measurement mode does not assert budgets, so main is not described as a green phone baseline.

The older `performance-head` batch (source `bc1df5f2a`) passed all 22 specials with Zoo S2 at3.974 ms and100 actors −3.674%; it is historical, not the final-source gate. Other repeated batches, including worse retained-source runs, remain in `performance-trials.json` and their source files. No sample was dropped to manufacture a pass.

Retained optimizations are the static callback extraction (`327222ce2`) and two-policy contact-bound cache (`7ef492f7f`), with exact physical/query oracles. Rejected private trials include the shared index, combined records, persistent owner cache, projection extraction, tighter separation envelope, split query loops, attachment flags, separate clear visitors and primitive event snapshots. Split query loops, attachment flags, separate clear visitors and primitive snapshots respectively pass21/22,21/22,20/22 and18/22 specials; the zero-movement sweep passes20/22. None is retained. Wide-query bucket culling is unmeasured after a300 s two-slot reservation timeout. `EventBus` keeps its original deep cloning. Their three-pair samples, source hashes and regression results remain in `performance-trials.json` and the named evidence folders. No passing private sample is substituted for the retained-source gate.

## Execution limits and remaining work

Full unit/sim/levels ran through `tools/remote/run.sh` with Vitest≤4 and private remote copies. Browser batches used fresh builds, headless Chromium, Metal WebGL, unique non-3300 ports, locks and≤2 workers. Reservations were bounded below20 minutes and released between batches. After earlier browser slot starvation exceeded30 minutes, unmeasured work was reported and later batches used five-second immediate admission. No deployment/merge back to main occurred. Generated `test-results` churn is excluded from the commits; review evidence lives here.

The historical full level rerun on `cd43c89b3` has **322 passed, one failed, two skipped**: L1→L2 continuity completes in241.9333 s against the unchanged210 s budget. The L2 checkpoint repair passes. The consumed-pickup filter in `327222ce2` fixes the carryover rerun: **135.45 s, no deaths**, with both unchanged continuity tests passing. Final590b full levels pass **323 tests, zero failures, two skips** on reserved runner3 (1925 s remote total). The historical continuous L1→L9/L10 runs pass.

The committed close-cover L2 policy's complete focused run has **27 passed, zero failed** (463.21 s on runner2). Both carryover tests, both escape-loop tests, all seven recovery units, completion timing/deaths, post-closure exclusion and seed2 calm-save checkpoint pass. The tick trace confirms the previously observed runner entered before closure; waiting under nearby police cover resolves it without changing gameplay or assertions. The full final levels run on590b also passes **323/0/2** (passed/failed/skipped).

The earlier04c4 browser selection passed94+16 functional assertions but its outer reservation charged one unit for two workers; it is retained as historical evidence, not the final compliant browser gate. The final one-worker shards use one unit each. Earlier vehicle cadence coverage17/17 used a quiet reservation; final-source repeat was requested with phone/Node timing but could not acquire quiet admission. Its camera implementation is unchanged.

The remaining red items are Zoo S2's4 ms budget and native phone frame budgets. Final-source Mac relative/phone timing remains unmeasured: neither five-second immediate quiet-admission attempt acquired a reservation. These are not waived by functional and graphics results.
