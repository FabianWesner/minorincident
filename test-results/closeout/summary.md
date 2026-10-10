# Epic closeout validation — 2026-10-10

Checkout: `epic-closeout`. Main merged at `4970fa9e` (including E24/L6). No deployment and no merge into main. Production lighting/VFX/L6 sources unchanged.

## Changes

- WebGPU crowd probe advances exactly 40 seconds of paused fixed simulation ticks and samples rendered frames. Input scheduling uses simulation ticks. It waits for a real courier strike before attacking, eliminating the 900-tick early-attack fallback. Original visibility, strike, kill and runtime assertions remain.
- L1 assisted travel consumes real clicks under the projecting camera and retries nearby clear ground inside the unchanged arrival tolerance. A body can no longer turn every movement retry into an attack.
- L3 travel gives the forward click 30 iterations to work between crowd retreats. Oak's route stays north of the crashed vehicle until beyond its full body. No teleportation, assertion change or timeout expansion.
- E17 missing-art test now deliberately aborts the integrated radio GLB request. Its original fallback and log assertions remain.
- Three obsolete AC clauses corrected from explicit PO change notes: E19 bicycle/world persistence, E22 single-seed newbie and line-break gates. Reports explain each correction.

## Gates

| Gate | Result | Evidence |
| --- | --- | --- |
| `git merge main` | Already up to date after initial fast-forward | Main `4970fa9e` |
| `npm run typecheck` | PASS, rerun after final test edits | typecheck-final.log |
| `npm run lint` | PASS, rerun after final test edits | lint-final.log |
| `npm run build` | PASS, rerun after final test edits | build-final.log |
| Remote unit + sim | Final head: **914 PASS**, 6 battery exclusions + 6 existing E27 deferrals, exit 0 | node-final-head.log/json |
| `npm run test:smoke` | Final head: **six Node and 26 browser PASS** | smoke-final-pass.log/json |
| Headless complete levels gate | **29/29 PASS**, final head, workers 2 | levels-final-pass.log/json |
| WebGPU courier-strike probe | 3/3 PASS under concurrent level browser job | flakes.log |
| L1 T-E19-23 assisted capture | 3/3 PASS under concurrent level browser job | flakes.log |
| L3 T-E21-19 | Final 9/9 PASS: each route 3/3, all zero deaths, concurrent browser load | flakes.log, L3-flakes-final.log |
| E17 browser contract/turntable/cap gate | 14/14 PASS | E17-browser.log |
| L1/L2/L4 mechanics | 11/11 PASS | mechanical.log, mechanical.json |
| Focused L4 mechanics | 7/7 PASS | L4-mechanics.log, L4-mechanics.json |
| Complete bot, single seed 1 each | L1 106.37s / L2 134.25s / L4 201.63s, all zero deaths | L1-seed1.json, L2-seed1.json, L4-seed1.json, single.log |
| `npm run assets:validate` | 1,012/1,013 slots PASS; only D-SUBWAY missing meshopt/quantization (deferred E24) | assets-validate.log, ../epics/E17/validate.json |
| Quiet native performance | 8/9 PASS; L1 desktop transitions fail unchanged 50 ms limit | perf.log, perf-conditions.jsonl |

Remote command:

```sh
sh tools/remote/run.sh "$PWD" --pull test-results/closeout/node-final-head.json -- \
  npx vitest run tests/unit tests/sim \
  --testNamePattern='^(?!.*(?:20 seeds|battery|T-E05-encounter)).*' \
  --maxWorkers=1 --no-file-parallelism --reporter=default --reporter=json \
  --outputFile=test-results/closeout/node-final-head.json
```

The first broader remote command was stopped when it included duel/crowd batteries not named `20 seeds`. The final command excludes those and encounter-balance batteries. No tests were modified to skip. The JSON contains six excluded battery cases and six pre-existing E27 deferred tests. The six exclusions are the axe 20-seed table, two ride 20-seed tables, duel/crowd batteries and encounter balance.

Browser jobs all use shared `tools/e2e-lock.sh`, headless Chromium/Metal, at most two concurrent jobs. Performance uses `tools/perf/quiet-run.sh`, reserving both slots. The first flake job overlapped the 25-test level job for its entire run. The final L3 repeats run while other lanes occupy the second browser slot. `L3-slot-load.jsonl` records lock owners, commands and timestamps during the repeats. `L3-slot-load.jsonl` has 45 samples with both slots occupied. The supplemental renderer started after the repeats; it is not credited as load evidence.

The normal per-epic `verify` selectors would run additional complete/newbie/idle/aggressive bot batteries. They were not invoked, respecting the maximum one single-seed completion pass per level. The component gates above are explicitly scoped; a full epic acceptance verdict is not inferred from them.

## Closure

All four full AC audit tables exist. Status remains `in-progress` for E17/E19/E20/E22 because non-deferred production, coverage and visual gaps remain. Reports identify partial assertions and historical evidence rather than equating matching test tags with acceptance.

The final L3 gate passed 9/9 in 8.6 minutes. The supplemental renderer acquired a slot only after these repeats had finished; its interval is not credited as contention evidence. Shared lock-owner samples demonstrate the actual overlap with other lanes.

Focused L2 reporting regression: **1/1 passed** remotely. The immutable first arrival timestamp prevents negative control latency after checkpoint rebasing; both ≥0 and the original ≤0.5 s bound are asserted. Typecheck/lint/build reran successfully after this collector change and another merge from main. Existing clean-main peer L2 reports are preserved under `../epics/E20/baseline-main4970/`; they show newbie median deaths 3, failing AC03. No additional completion battery was launched here.

Native performance: L1 desktop transitions failed at 218.6 / 221.4 / 232.0 ms; mobile transitions and three L1 spots passed. L2 high/low passed. L4 high/low passed their measured budgets, but the high fixture does not reach the AC20 population workload. Supplemental E19 browser gate passed 6/8: cue timing exceeded 50 ms and one corgi fixture had insufficient moving samples.

Source commits: `5104953d` (browser stabilization/spec corrections), `003593ce` (L2 reporting clock and regression), `d474905b` (L5 readiness/follower guard), and `ad9e7961` (exact L1 input floor). Final functional gates after the main merge are recorded in `levels-final-pass`, `smoke-final-pass` and `node-final-head` logs/JSON.

| Epic | Status | Remaining non-deferred acceptance gaps |
| --- | --- | --- |
| E17 | in-progress | Priority inventory below integrated; five-view comparison coverage is only representative. |
| E19 | in-progress | Horde capture hides courier; desktop transitions exceed 50 ms; full population/encounter evidence unavailable within the battery limit. |
| E20 | in-progress | Clean-main newbie median deaths 3 > 1; idle/aggressive/no-axe and checkpoint evidence incomplete; streets capture obscures courier. |
| E22 | in-progress | Handgun six-second criterion mismatch; observed further turns zero; natural-turn/full-population coverage incomplete; war-line framing fails review. |

## Final-code gate attempts

- Broad remote gate on final code: **913 passed, 1 failed, 6 battery exclusions + 6 existing E27 deferrals**. The only failure was T-E08-11-high: L3 patrol sim p95 **4.5255 ms > 4 ms**. Its isolated one-worker rerun on the other pool runner passed all L1–L5 bounds; raw results and host provenance remain in `node-final-code.log/json` and `patrol-isolated.log/json`. A serial full gate is recorded in `node-serial-final.log/json`. No timing assertion was changed.
- First unsplit final-code level gate: **28 passed, 1 failed**. T-E23-17 had three following survivors instead of five: Sam and Rosa turned during the search. The required assertion remains five. `levels-final-code.log` preserves the failure; `L5-recheck.log` records its recheck.

The L5 gate failure exposed an additional setup race: Begin starts streamed scene preparation, while the paused helper immediately advances input. `GameView.ready()` explicitly settles preparation once the mission is playing. The helper now awaits the existing `screenshotReady()` readiness path after Begin and pause. A speculative body-click retry did not fix the loss and was removed; temporary first-loss instrumentation was also removed. All original assertions and timeouts remain. Readiness repeats are in `L5-ready-repeats.log`.

Final serial remote gate: **914 passed, 6 battery exclusions + 6 existing E27 deferrals, 190 files passed**, exit 0 in 2,040.50 s. L3 high patrol p95 **2.8628 ms ≤4 ms**, same runner that failed the broad invocation. No assertion or timing budget changed. Runtime and unit/sim sources are unchanged by the subsequent L5 browser-only commit `d474905b`; a further final-head gate after the optional debug projector change is recorded in `node-final-head.log/json`.

Readiness alone passed 1/2 L5 repeats; the travel helper also restarted walking after every fight while followers were lagging. Commit `d474905b` keeps movement stopped during those guard cycles and settles scene preparation after Begin. Final focused repeats: **2/2 passed**, all five sheltered, with the unchanged loop bounds, assertion and timeout (`L5-guard-repeats.log/json`).

The next full level invocation found a further L1 unassisted bay-entry failure. `RayCursor` intersects the floor beneath the courier, but the old input projector used the destination floor. At the raised station bay this shifts the requested click beside the doorway. The L1 movement helper now projects onto the exact authored courier input plane through an optional debug-projector plane argument, preserving the original arrival tolerance and clear-ground checks. Fresh repeats pass **6/6**: three consecutive unassisted and three consecutive assisted routes (`L1-plane-repeats.log/json`). Commit `ad9e7961` exposes an optional player-floor projection without changing the default debug projection or production controls.

The L5 guard fix also passed its third consecutive playthrough inside the complete 29-case gate. That invocation finished **28/29**: only the L1 raised-bay projection failed; its correction subsequently passed six repeats. The original full-run failure remains in `levels-green-final.log` and `levels-green-attempt.json`.

A load-only remote probe confirms the failed courier position is on 0.13 m paving and the destination is at 0.53 m (`L1-plane-heights.json`). The projector uses authored ground height, avoiding capsule clearance approximations. No extra completion bot ran.

Final complete headless level gate after merging main: **29/29 passed** in 7.9 minutes, two workers (`levels-final-pass.log/json`). L5 shelters all five, its fourth consecutive pass after the guard fix. Tracked generated E23/E24 evidence is restored to main; this lane retains only its relevant audit evidence.

Final-head smoke after the main merge: **6 Node + 26 browser tests passed**, exit 0 (`smoke-final-pass.log/json`). The earlier polling browser job was cancelled while still queued; the final run joined the kernel lock queue and reran both smoke components.

Final-head remote gate on `ad9e7961`: **914 passed**, 190 files passed, six battery exclusions and six pre-existing E27 deferrals; exit 0 in **2,178.86 s** on runner `2.31.51.253`. L3 high patrol p95 **3.794257 ms ≤4 ms**; all high/low patrol budgets pass. Evidence: `node-final-head.log/json`. All requested functional/static gates are green; acceptance gaps keep all four epic statuses in progress.
