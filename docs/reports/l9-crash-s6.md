# E31 · L9-S6 forced crash

L9 now starts seated in the transferred APC (or the standalone APC), applies the mission floor policy, and ends only after the mandatory crash and crawl-away. The approach strip at the authored x=470 anchor catches road and off-road bypasses before the x=550 outskirts trigger. Healthy and zero-durability arrivals use the same latched sequence: 3 s approach, 2 s fall into the visual gully, 3 s impact/wreck beat, then 6 s crawl to the authored safe endpoint. The player is protected throughout; the shared E27 blast produces panels, smoke and audio without damage or ground-fire hazards. Ordinary vehicle destruction remains unchanged.

The controller validates the capsule and entire crawl corridor against live colliders and navigation, choosing `crawl-fallback` when the primary corridor is blocked. The existing `crawl` clip loops during the movement. Driving, interaction and weapon input are claimed by the story lock. The camera returns to the game camera for crawl-away. The actual wreck variant takes precedence over the unarmed shell, retains no mounted gun, and does not receive a newly constructed cab. All three wreck LODs are warmed with their actual damage materials and consumed from that pool at the swap; this removed first-use shader hitches at the two crawl LOD boundaries.

`Mission.l9.state` / the `l9` state snapshot expose phase, vehicle ID, start tick, pre-crash durability, crawl anchor, finished and ended flags. Checkpoint seams retain the phase; `CampaignSave.l9Crash` holds the current vehicle/player records for page reload. Loading approach, fall, impact or crawl shifts its clock and resumes without replaying an impact. Loading the committed end emits no second completion. Events are `l9.crash-approach`, `l9.bridge-collapse`, `l9.crash-impact`, `l9.crawl-finished`, and one ordinary `level.completed`. L9-S7 owns the atomic axe-only L10 handover and must clear `l9Crash` after committing it. This lane covers the crash portions of AC01/10/14/15/16, not the later lanes' inventory, population or all-route performance gates.

No epic criteria or asset sources were edited. The two requested matrix entries are `specs/scenes/catalog/l9-crash-sequence-{0,1000}.json`. `src/assets/staticCollision.ts` is unchanged.

Validation and captures are stored under `test-results/epics/E31/S6/`. Commands use the Hetzner wrapper for Vitest and the machine-wide browser locks for headless Metal/WebGPU captures. Native timing uses `tools/perf/quiet-run.sh` and the production build, with a 1600×900 high view and a 390×844 low view at 4× CPU throttling.

| Native crash/crawl fixture | High | Low |
| --- | ---: | ---: |
| Frame p95 | 4.5 ms | 8.0 ms |
| Sim p95 | 0.4 ms | 1.2 ms |
| Worst frame | 17.6 ms | 34.5 ms |
| Draws | 107 | 86 |
| Triangles | 241,359 | 160,676 |
| Heap after GC | 140.4 MB | 107.9 MB |
| Particles / puffs / parts | 244 / 77 / 3 | 67 / 40 / 3 |

Both fixtures meet the unchanged E18 limits, including the high-tier ≤50 ms hitch gate. This is the S6 crash site fixture; populated route sweeps remain with L9-E1/Q4. Headless WebGPU evidence does not replace the epic's manual device checks.

The game-camera sheets show the six-wheel hull approaching the torn road edge, descending beside the fallen slabs, and the impact/fire/smoke at the gully wreck. The player emerges on the far lip, remains readable against the dry night road, and moves in a low crawl pose toward the endpoint ring. Close zoom enlarges the crawl pose while the impact camera keeps the gap and wreck in view; the low tier retains the same road lips and silhouette. Healthy and floor shots show the same irreversible sequence. The final high/low × zoom 1.0/0.5 × WebGL2/WebGPU matrix passes all 16 entries. Both tiers were visually reviewed at both zooms; no missing road lip, premature wreck, gun attachment, blocked crawl spawn or unreadable courier was found.

Regression evidence: the final crash/checkpoint/page-reload suite passes 15/15, including exactly one stop/crash cue, and the E27/VFX regression subset passes 23/23. The keyboard approach/crash suite passes 8/8 on both backends and tiers. The 17 L4 ride configurations pass (16 initially, one stable-build retry after a transient asset 404), and the L1/L2 browser regressions pass 5/5. A production rebuild during the first broad browser run caused an asset 404; that run is not counted as a clean gate. Final `verify -- E31` passes with 45 selected unit/sim tests and 40 browser tests. The five L9 checks for preparation, checkpoint death, navigation and pickup grounding pass too.

The full remote unit run passes 1,298 tests with one failure in `tests/unit/physics-metadata.test.ts`; its three GLB metadata mismatches reproduce on untouched base commit `508879b1`. The L5 follower-spacing (`T-E23-09`), L2 cluster (`T-E20-13`) and weather graph (`T-E28-08`) failures also reproduce on that base. No budgets or criteria were relaxed. The first reload fixtures were corrected to use a valid campaign preset and the real `applyCampaign` setup; the graph expectation now includes L9's immediate progression alongside L2–L5/L8. These changes strengthen coverage of the newly registered mission without changing earlier levels' expectations.

The full remote sim/levels sweep completed with 1,084 passed, 28 failed and two skipped in 144 files. It ran before the six L9 fixture/graph corrections above, which now pass. Remaining failures include older campaign pacing/continuity/navigation/objective assertions and the shared Alpha/zoo wall-clock suites on the loaded runner. The four baseline failures named above were reproduced; the other unrelated failures were not all rerun on baseline. This sweep is not reported as green, and no unrelated gameplay code or test limits were changed.

Committed review evidence is limited to this lane's compressed matrix sheets, catalog results, native timing and the five L9 regression records under `test-results/epics/E31/S6/`. Generated L1/L2/L4 screenshots were restored. The report's timing table is the final captioned production build; the impact caption is visible through the impact beat and the first part of crawl-away.

An initial verifier invocation was stopped after noticing that its default Vitest path was local. All completed verifier runs used `MI_VERIFY_REMOTE_SIM=1`; the final run is green. No local full unit/sim sweep was used as validation.
