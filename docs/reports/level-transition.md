# Level transition coverage and loading

## Cause and changes

The automatic campaign handoff bypassed the menu loading panel. The old view was reset before the replacement was ready, and production loading could return while shader warm-up still hid the canvas.

A shared, opaque transition card is mounted independently of the full menu HUD. Menu selection, campaign continuation and restart show it before teardown. It contains the level number, campaign title, authored briefing story and a progress bar. Three's completed asset items and completed shader groups drive progress; stage completion accounts for layout/simulation/audio work. Progress is monotonic, rather than a timer. The card disappears after the full size scene draw has had a presented frame. A failed load keeps the card and offers retry. Accepting a speculative menu load preserves its progress; an older load for a different level cannot advance the selected card.

Final mission objectives trigger low priority next-level HTTP prefetch (four requests at once). The URL list includes authored dressing, decay variants, actors and action models. Prefetch does not assemble layouts or parse GLBs. A bounded CPU cache reuses baked crowd clips and prepared/simplified civilian geometry across levels and restarts; scenes own independent geometry clones and animation attributes. Optional district LOD streaming starts after the first five seconds of play. Shader warm-up yields between 64-leaf WebGL groups (16 on WebGPU); animated WebGL batches execute both ordinary and instanced paths in groups of four, sharing GPU fences while keeping their projected positions separate. Actor centers align with pixels in the 32px warm-up target. Foreground WebGPU keeps its existing draw-based compilation policy. Mesh visibility, matrices, counts, culling and renderer size are restored.

The authored animation JSON libraries are emitted as their own 1.94 MB chunk to keep the shared Physics chunk below the existing 2 MB warning threshold. The warning was caught by the full remote unit suite's build check; the threshold and assertion remain intact.

Validation also exposed a remote-runner disk leak: the results-pull loop left `IFS` set to newline, preventing cleanup from splitting SSH arguments. `3cef87c9` restores `IFS` before the EXIT cleanup; shell syntax and an argument-splitting check pass. Only completed workspaces belonging to this job were manually reclaimed.

## Measurement method

Production builds, headless Chromium on the Mac with ANGLE Metal. High: 1600×900, DPR 1, high quality. Phone tier: 390×844 portrait, touch, low quality, DPR 1, CDP CPU throttle 4×; this is emulation, not a physical phone measurement. Seed 1, muted audio. Speculative menu scene preload is disabled in both builds to measure an actual load. Both builds get a standardized two-second final-objective/outro window. L1 result reading time is excluded by continuing immediately.

The transition test covers menu→L1, all five campaign handoffs and restart L6. CDP PNG screenshots are sampled every 250 ms from capture start, allowing extra time only when capture/decoding exceeds that interval. Captures run independently of page JavaScript, so synchronous layout assembly cannot stall the sampler. PNGs are decoded in memory and never saved. Card visibility and progress are observed separately on animation frames; `cardSamples` counts those DOM observations, not PNGs. Each sample must show the card or varied scene pixels in the central canvas. It also checks completed, monotonic progress and measures frame gaps for five seconds after beginning each mission. A separate regression covers the compact controls HUD shown in the PO screenshot.

Baseline: main `98e9aa79`. Candidate production changes: `23f8fba8`, based on main `d27704a2` after the required merge. The original baseline predates the concurrent small-figure/main changes, so timings compare complete builds rather than isolating every millisecond to this patch. Native timings use `tools/perf/quiet-run.sh`, which owns both browser locks and waits for load below 3 before starting.

## Results

All seven measured transitions passed coverage and progress assertions on both tiers: **zero uncovered blank samples**. The baseline had nine uncovered samples on high and nine on phone, across L3–L6. The compact controls HUD, speculative menu preload and restart regressions also pass. The compact-HUD card was visually inspected: readable title/story, existing dark/orange styling and visible progress. Its QA screenshot was deleted.

Seconds from menu selection / level complete / confirmed restart to the first ready scene frame:

| Transition | High before | High after | Phone before | Phone after |
| --- | ---: | ---: | ---: | ---: |
| Menu → L1 | 12.12 | 10.48 | 17.68 | 17.21 |
| L1 → L2 | 7.71 | 4.85 | 22.42 | 14.46 |
| L2 → L3 | 11.78 | 8.80 | 38.94 | 30.87 |
| L3 → L4 | 8.63 | 2.53 | 14.19 | 5.81 |
| L4 → L5 | 5.95 | 2.53 | 14.79 | 6.46 |
| L5 → L6 | 15.78 | 6.48 | 19.95 | 11.72 |
| Restart L6 | 15.56 | 4.18 | 19.78 | 6.96 |

The high-tier <=3-second target is met for L3→L4 and L4→L5; **it is not met for the other five loads**. All measured loads improved, but cold L1 and synchronous simulation assembly still dominate. Final L3 spends roughly 5.6 seconds constructing its simulation before view preparation. HTTP prefetch cannot remove synchronous layout assembly or cold GLB/actor preparation; further reduction requires moving that CPU work earlier or out of the foreground.

High-tier first five seconds of play: **zero frames over 50 ms for all seven loads**, maximum 16.8 ms. Optional district streaming initially caused L5 hitches in an intermediate run; the five-second settling interval eliminates those in the final run. Phone frames over 50 ms, before→after: L1 5→1, L2 5→3, L3 5→1, L4 1→1, L5 10→2, L6 0→0, restart 0→0. Phone therefore still has existing first-play stalls; a zero-stall phone gate is not achieved.

The capture loop requests samples at 250 ms cadence, but capture itself can take longer while Chromium is busy. These are sampled coverage checks, not proof of every presented frame. Counts, frame-gap comparisons and load stages are retained in [level-transition-metrics.json](level-transition-metrics.json); raw PNG samples are discarded in memory.

## Validation

- Typecheck, lint and production build: passed for `23f8fba8`; no bundle warnings. Typecheck and lint also passed after the CDP test harness update `e5747700`.
- Full remote unit suite: **469/469 passed**, 131 files, two workers, 120-second timeout, runner `94.130.181.173`. This includes the typecheck/lint/build static check and the new progress, cache and shader-group regressions.
- Paired native baseline: two tier tests passed, two candidate-only regressions skipped.
- Candidate transition and restart suite: **7/7 passed**.
- Existing L1–L6 high/phone performance: **13/14 passed**. L4 phone fails the collapse triangle budget, 517,397 > 500,000. The saved pre-change baseline also fails the same gate, 505,019 > 500,000; its L2 phone comparison passes. The full performance acceptance gate remains red.
- Full level suite: **29/31 passed**. L2 `T-E20-18` and L3 Commerce `T-E21-19` fail waypoint navigation. An isolated one-worker retry passes L3 Commerce but still fails L2. The original pre-change baseline passes both routes and L6 escort (3/3). A clean, already-built current-main `d27704a2` control also fails L2 navigation (at a different waypoint), while L3 Commerce passes. The full level gate remains red; these controls do not isolate every possible timing effect of this patch.
- Smoke and E12 verification: running/pending.
