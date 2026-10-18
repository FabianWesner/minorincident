# merge-batch10

Integration and QA are in progress on `lane/merge-batch10`. No main merge or deployment was performed. Base/control: `fcf81b4da` (main `6e4e37634` plus the supplied documentation commit).

## Integration and fixes

1. `lane/merge-batch9` integrated, followed by `lane/wave3-sim`; the only merge conflict was `package.json`, resolved by retaining both matrix filters.
2. `lane/vfx-stunning` at `b0bda6996` and `lane/atmosphere` at `50711a25a` integrated in order, without conflicts; the exact final foreground tint revision `68e108f24` is an ancestor. Pair 2 full unit/levels/sim is running on Hetzner.
3. L6: raw keyboard/joystick motion could leave the authored room even though the planner's navigation mask rejected that space. The physical controller now slides along the L6 room boundary, including crowd push. A raw-input regression and `qa-l6-room-boundary` cover the change. The physical test's gate selection now waits for retreat: its empty pre-retreat follower list had incorrectly meant that everyone crossed. The game’s eligibility and every zero-death / ≥60% / seven-photo / gate / straggler / exact-handover assertion are retained.
4. L6 readability: white health-bar raster edge pixels just outside fractional rectangles contaminated the eye sample. Bounds now round outward to the actual pixel extent. Numeric eye/player thresholds are unchanged.

The 22 changes in `src/assets/staticCollision.ts` are only fingerprints for GLBs whose reset metadata wave3 changed; IDs, collider boxes, source paths and ordering are identical to base. [Structural evidence](evidence/collision-fingerprints.json). No unrelated collision bake churn is retained. No L5 tuning, protected reference directory, test threshold or budget was changed.

## Validation

| Check | Result | Evidence |
| --- | --- | --- |
| Pair 1 remote full unit/levels/sim | Running | [Log](evidence/remote-pair1.log) |
| Pair 2 remote full unit/levels/sim | Running | [Log](evidence/remote-pair2.log) |
| Original eight reds, isolated main control | Complete: four red / four green on unchanged `fcf81b4da` | [Log](evidence/remote-main-isolated.log) |
| Initial priority browsers | 3 passed / 2 failed | [Log](evidence/browser-priority-pair1.log), [JSON](evidence/priority-initial/playwright.json) |
| L6 corrected strict run | **Pass: 23/29 rescued (79.3%), zero deaths, seven photos, gates, rejoined straggler and exact L7 carryover; 5.4 min wall time** | [Log](evidence/browser-l6-retreat-gate.log) |
| Wave3 browser backend/tier/zoom matrix | **16/16 pass**, both backends/tiers, zoom 1/.5; 7.1 min | [Log](evidence/browser-wave3.log) |

The initial red `T-E24-17` remained playing at approximately `(89.84, 10.79)` and never reached the exit. A subsequent boundary-only diagnostic run was interrupted once its pre-retreat gate-selection cause was identified. `T-E24-15 shelter-fails` initially measured courier contrast **3.851:1**, but sampled a white health-bar boundary (red dominance **0**, required **60**). Both now pass. The final shelter sample has red-dominance margins **131/132/132** (required ≥60), with all player contrast/hero-shadow assertions retained. [Passing log](evidence/browser-shelter-pixel-bounds.log), [numeric evidence](evidence/priority-final/l6-shelter-fails-readability.json).

The initial passing cases are minigun touch (13.1 s), L7 keyboard/mouse through L8 (2.7 min), and L7 touch pickup/corridor (6.7 s). The L7 route test has no survivor-ratio assertion, so its pass alone does not approve follower survival.

## Original eight remote reds: isolated main control

Control source is `fcf81b4da`, using one Vitest worker on runner `2.28.24.66` through the two-slot timing isolation wrapper. Each test file runs in its own Vitest environment. These are fresh measurements, not historical attributions. [Raw log](evidence/remote-main-isolated.log), [per-test results](evidence/main-isolated-summary.json).

| Test | Red on main? | Isolated main result |
| --- | --- | --- |
| T-E07-11-alpha-physical-200 | **Yes** | 4.118 ms p95 > 4 ms |
| T-E07-11-alpha-200 | No | Pass |
| T-E32-11-perf-200 | **Yes** | 4.048 ms p95 > 4 ms |
| T-E07-11-zoo-s1-200 | **Yes** | 4.894 ms p95 > 4 ms |
| T-E07-11-zoo-s2-200 | **Yes** | 4.664 ms p95 > 4 ms |
| T-E07-11-zoo-s3-200 | No | Pass |
| T-E23-12-kill PO #37 | No | Pass |
| T-E17-02b | No | Pass |

Four of the previously observed reds reproduce on main; Alpha scheduler, zoo S3, production asset contracts and L5 close-shell kill pass in isolation. No L5 enemy or damage tuning was changed. Candidate isolated results are pending.

The two WebGL `wave3-zoo-routines` wide-zoom (`z1.5`) rows fail the unchanged clipping gate (`2 > 0`) on both high and low. Both failures **also reproduce on main** using the same fixture against the immutable control build. [Control log](evidence/main-zoo-catalog.log).

## Native timing and blast hitch

Both main and integrated builds pass the existing headless native Metal desktop E18 horde and high/low E27 explosion gates, with one existing WebGPU-only manual test skipped per the repository policy. Each complete reservation was bounded below 20 minutes and released. [Main log](evidence/main-native.log), [candidate log](evidence/candidate-native.log), [raw comparison](perf/blast-comparison.json).

| Measurement (ms) | Main | Integrated |
| --- | --- | --- |
| E18 desktop high horde p95 | 6.3 | 6.5 |
| Blast high frame p95 / max | 8.1 / 180.8 | 6.6 / 290.4 |
| Blast low frame p95 / max | 13.4 / 79.1 | 11.6 / 80.8 |
| Blast high sim p95 | 0.6 | 0.6 |
| Blast low sim p95 | 2.3 | 2.2 |

**Cold blast hitch is worse in this paired sample:** high maximum rises from 180.8 to 290.4 ms at approximately 1.96 s after the mega trigger. Both builds have a cold spike there. Passing steady frame/simulation p95 gates does not certify equal cold hitch; no such claim is made. The low maximum changes from 79.1 to 80.8 ms. The recorded conditions and exact timings are retained, without loosening any budgets.

## Images actually opened

- [Initial L6 shelter-fails](evidence/priority-initial/l6-shelter-fails-readability.png): courier/headlamp are clearly visible in the warm pool near the ticket machines. Nearby survivors remain dark gray, and three red-eyed infected are visible to the left. White health-bar outlines overlap the eye measurement rectangles; the brightest white pixels are HUD geometry rather than eye emission. This is diagnostic evidence before outward raster rounding.

- [Strict L6 route and pair](sheets/l6-strict-route.jpg): warm shelter pools give way to a gray, confined retreat with red emergency accents; the courier stays lit while the cohort stretches along the rails. The result visibly reports zero deaths and 23 rescued. The matched Northgate poses show differing L6 exit-patch/L7 world geometry and gray-to-blue ash lighting, so the input/state handover pass is not a claim of seamless visual continuity.
- [Wave3 breach](sheets/wave3-breach.jpg): both tiers and backends retain the warm courier/headlamp pickup circle at both zooms. Breach subjects are deliberately offscreen; the spatial JSON assertions establish their access/frustum positions.
- [Wave3 destroyed corridor](sheets/wave3-seam-destroyed-corridor.jpg) and [dispersal seam](sheets/wave3-seam-dispersal-complex.jpg): courier feet rest on continuous asphalt/white route markings across all eight configurations; no crack or floating pose is visible. The delayed-load probes show sparse roadside surroundings in these fixed seam frames; they do not establish the full dispersal building composition.

## Environment and fairness

All browsers are headless, use ANGLE/Metal for WebGL on this Mac, private ports, shared browser locks and no more than two Playwright workers per command. Remote heavy suites run on Hetzner. Quiet reservations will be bounded to under 20 minutes and released between batches. A Python wrapper records a timeout and terminates only its own process group at the reservation deadline.

The shared root `node_modules` directory became empty during initial runs. This worktree's symlink was replaced with its own `npm ci` installation (246 packages; zero audit vulnerabilities); the root directory was not modified. The first main build failed with `vite: command not found`; rebuilding against the private installation passed. An initial temporary diagnostic had a Playwright function-serialization error, then succeeded with a page-local name helper. Neither environmental failure is counted as a gameplay pass.


## Final atmosphere, VFX and phone coverage

Atmosphere final revision `68e108f24` is captured at both tiers and all three zooms on both backends: **120/120** structural draw/triangle budgets pass. Raw stills and actual backend/quality/camera metadata are in `docs/reports/atmosphere/batch10/`; [counter comparison](atmosphere-counters.json). Opened all six L5/L9/L10 before/final sheets under `sheets/atmosphere-{webgl2,webgpu}/`: L5 keeps brick shelter warmth and a dark purple foreground; L9 preserves green haze and readable headlights; L10 changes the road patch from cool blue to purple while the guide ring and courier remain readable. The L9/L10 fixed patches are sparse road views, not proof of complete region decoration.

Final cover-ray/contact cases: **32/32** pass (before/final × both backends × both tiers × zoom 1/.5). Opened all eight configuration sheets and both effect timelines in [VFX sheets](vfx-final/sheets/); [costs](vfx-final/costs.md) are concurrent CPU submission measurements, not quiet native frame times. The cover ray stops at the near dumpster face with dust/glints, and the protected target retains its health. High contact shows short white metal sparks; low keeps fewer glints. The late contact timeline shows an APC and detached wheels airborne on both main and candidate; this capture does not certify vehicle stability. Raw sheets/metrics are retained in `vfx-final/raw/`.

Phone UI: **84/84** pass (seven scenes × three zooms × two orientations × two backends), with Pixel 7 touch/mobile emulation at low quality. Opened all four `sheets/phone-{webgl2,webgpu}-{390x844,844x390}.jpg` sheets. Barricade prompts retain their dark backing; at closest zoom the courier is large and portrait facing samples crop peripheral followers. Fog/snow/rain leave the courier/headlamp identifiable; thunderstorm has visible rain and diagonal wind streaks. L6's landscape HUD is crowded by the roster/objective/prompts but keeps the gate action visible. These are game-camera captures and emulation, not physical-device measurements.

Final integrated WebGL catalog: **130/132** pass across both tiers and zooms .5/1/1.5, including the corrected raw L6 room-boundary fixture. The only reds are the two zoo wide-zoom clipping rows reproduced on main. [Log](evidence/matrix-final-webgl2.log).


## Cold blast investigation and fix

The requested 290.4 ms sample was preserved. Controlled lane-boundary builds measured high maxima **181.0 ms before VFX, 162.9 ms after VFX, 164.9 ms after atmosphere**. Thus the sampled increase to 290.4 ms did not reproduce consistently, and these results do **not** attribute it to the VFX lane. [Exact source manifests and raw results](perf/blast-bisect-and-fix.json).

The first loading fix (`6265c973a`) included all combat scenes in the full HDR/MSAA warm-up and gave detached panel/rib draws unoccluded driver warm-up. It alone **did not solve** the secondary spike: high max remained 171.1 ms. WebGL instrumentation then recorded a new frozen infected-corpse program linked at +2025.7 ms with a **139.6 ms blocking program-status wait**. Its placement/state/appearance attributes identify the static crowd graph, not the VFX quad graph. [Instrumented raw trace](perf/gl-diagnostic-before-high.json), [program source](perf/program-60.glsl).

`2daeeaf4a` prepares the actual LOD2 infected corpse pages in every combat scene before the loading draw. Previously preparation ran only on L7, selecting LOD1 on high even though dead infected use LOD2. The final six regression cases cover blast-stress/L4/L7 × high/low; **28/28 focused remote tests pass**, including pre-render and blast pool tests. No effect, assertion, threshold, enemy tuning or budget was removed.

Quiet native remeasurement after both fixes: **high frame p95 6.4 ms / max 111.7 ms; low p95 13.1 ms / max 28.7 ms**. The ~2 s compile spike is gone. High retains a later +4.65 s 111.7 ms spike, corresponding to the ~109–114 ms event already observed on main and both intermediate lane builds. This exceeds a 50 ms transition/hitch target; the existing E27 p95 gate passes, but this report does not certify every cold frame below 50 ms. [Native raw results](perf/corpse-warmed/), [log](evidence/corpse-warmed-native.log).

A follow-up diagnostic appended to that reservation failed to launch its preview because Playwright interpreted the report-local config's server working directory relative to the config. Its 30 s server timeout is environmental, after the three native tests passed (one existing WebGPU manual skip). The diagnostic config now explicitly uses the repository cwd; final confirmation remains pending.


### Final cold blast result

The corrected follow-up diagnostic passes and records **zero shader links during the seven-second measurement**. Its CPU profile identifies the remaining ~4.6 s spike as an asynchronous `CrowdView.loadBatch` completion (close-detail infected geometry baking/upload), rather than another VFX shader. [Diagnostic summary](perf/gl-diagnostic-after-summary.json), [CPU profile](perf/gl-cpu-profile-high.json).

`a44bc8d53` prepares close-detail batches for the initial resident models during loading on high quality; low retains its existing LOD2 set. This moves the same eventual geometry work before play without changing model detail, effects or entity counts. The final focused remote suite is **30/30 green**, including high-resident/low-LOD2 selection and six corpse preparation regressions. Typecheck/lint/build pass. [Remote log](evidence/remote-resident-unit.log).

Final quiet native run: **cold high frame p95 6.6 ms, max 12.7 ms; cold low p95 12.7 ms, max 26.8 ms**. Neither tier records a >34 ms spike. Simulation p95 is 0.6/2.1 ms, within the unchanged 4/6 ms budgets. All three native tests pass; the existing manual WebGPU parity case remains skipped. The reservation was released after completion. [Native log](evidence/resident-warmed-native.log), [raw measurements](perf/resident-warmed/), [quiet conditions](evidence/resident-warmed-native-conditions.jsonl).

Compared with the original samples, high max improves **180.8 ms main / 290.4 ms integrated → 12.7 ms fixed**; low improves **79.1 / 80.8 → 26.8 ms**. The large original increase was not consistently attributable to one merged lane; the measured causes were cold corpse programs and late resident LOD0 work already present on main. The final sample satisfies the 50 ms desktop hitch target as well as E18 steady budgets, with all effects retained.

E26's first verify had **34/34 remote tests pass**, then its active preview crashed when a source-fix rebuild replaced `dist` (`ENOENT` streaming a crates buffer); 32 downstream connection failures followed. This is an integration-runner error, not a measured main/candidate gameplay difference. The complete E26 verify is being repeated with a report-local npm wrapper that still performs the fresh build but writes it into an isolated scratch output directory. Active browsers keep reading the already freshly built final `dist`.


The first three-file UI browser set completed **37 passing / four failing**, all four at the L6 gate's closed state. An intermediate held-input experiment did not fix the failures and was reverted. Diagnostic state recorded **13 of 29 survivors snapping back behind the gate on the first tick**, because the fixture wrote transforms without collision authority. `6b96e860a` stages the cohort with `world.solids.relocate` and 1.1 m spacing beyond the gate. Production hold rules, one-press fixture script, frame 61/81/106 gate-state checks and all viewport bounds remain unchanged. The final test passes **4/4**, covering both backends/tiers and three viewport sizes × three zooms × all barricade/gate states. [Final log](evidence/browser-ui-staging-final.log).

The corrected phone gate recaptures pass **12/12**: both backends × three zooms × portrait/landscape, low tier. Opened all four `sheets/phone-gate-final-*.jpg` timelines. The torch-lit courier and slatted gate remain identifiable; at closest portrait zoom the cohort is cropped. The gate prompt changes to crate guidance after closure, then damage/break actions; the roster/objective make landscape HUD dense but panel edges remain inside the viewport. The final browser tests establish actual intact/broken state; these images alone do not establish it.

The first blast fixture qualification left one victim at 6.4 HP in all six WebGL rows. Moving that victim inside the authored blast's lethal radius retained the zero-health assertions; the corrected WebGL blast matrix is **6/6 green**. Opened the corrected low z.5 timeline: the red sedan burns, the secondary beat fills the close game-camera view with white/yellow fireballs, metal panels/wheels tumble, and persistent fire/glow remains. The closest crop loses peripheral bodies; zero-health measurements establish their deaths, not their on-screen visibility at every frame.

Opened the high z1 raw L6 room-boundary sheet: the lit courier advances to the edge by frame 180 and stays at the same stopped position through frames 240/300, beside the dark wall and green headlamp footprint. The capture shows a local boundary probe, not the complete retreat route.

Opened both `sheets/blast-final-{webgl2,webgpu}.jpg` comparisons (high/low, zoom .5/1): warm ground glow, red sedan, luminous yellow/white secondary fireballs, thrown panels and persistent fires remain on both tiers/backends. Low has fewer small puffs but retains the large secondary beat. At zoom .5 the blast fills the crop and peripheral corpses leave the image; at zoom 1 the five bodies and distant blast ring fit. Also opened the low z1 boundary timeline: the courier stops beside the room edge while the green headlamp footprint extends over the dark wall. [Explicit sheet inventory](opened-sheets.json).

## Remaining simulation blockers

The complete E24 bot passes with 24/29 rescues and zero deaths, but the **newbie bot fails with 8/29 rescued** (required ≥40%), despite completion and zero player deaths. It takes ~23 minutes wall time for 257.95 simulated seconds. The exact isolated main newbie test passes in 27.5 seconds: **red on main: no**. [Candidate verify log](evidence/verify-E24.log), [main log](evidence/remote-main-newbie.log), [main result](evidence/main-newbie.json). This is separate from the passing strict real-input 23/29 zero-death route and blocks approval of the full E24 simulation gate.

The E24 side-entry telegraph/stagger test also fails in both paired suites and the E24 verify. The same side-entry test passes on the unchanged main snapshot in **5.3 seconds**: **red on main: no**. [Control log](evidence/remote-main-side-entry.log). The local main-control worktree was already removed; this comparison reused its immutable private runner snapshot and deleted that extra remote copy afterwards.

## Disk cleanup

At the orchestrator's request, removed both bisect worktrees using `git worktree remove --force`, then preserved the completed main L6 comparison JSON and removed the main-control worktree the same way. Available disk space rose from the reported 10 GB to **35 GiB**. Pending remote comparisons use already copied private runner snapshots; no control git worktree remains.

The uncollected cold-blast `performance.memory` heap readings exceed the raw 400/250 MiB tier targets on both main and candidate (main high/low ~819/437 MiB; final fixed ~676/404 MiB). The cold fixture does not assert heap. Frame/simulation passes do not establish a heap-budget pass; the separate weather and mixed-outbreak heap assertions are being run unchanged.

### Strengthened gate confirmation and other native results

A second quiet reservation at final source `6b96e860a` passes the added **cold high maximum ≤50 ms assertion**, without changing the E18 target. High p95/max **6.9/12.3 ms**, low **12.1/26.3 ms**, sim p95 **0.6/2.1 ms**, no >34 ms spikes. Desktop E18 horde, high/low trailer light-lab and desktop/phone L1 morning/night lighting all pass. This batch finishes **9 passing, one existing manual WebGPU skip, two weather failures**. [Log](evidence/native-final.log), [all per-test outcomes and raw values](perf/final/), [quiet conditions](evidence/native-final-conditions.jsonl).

Weather's unchanged native frame/simulation gates pass (high frame p95 5.1 ms, low 6.0 ms); the **heap assertions fail**, high **547.66 MiB >400**, low **263.78 MiB >250**. The isolated main control is pending. No heap assertion or budget was changed. A fresh immutable main build is being produced on the runner and copied as build output only; no local control worktree is recreated.

The isolated main L10 campus corridor control passes both tiers (high 37.7 s, low 24.1 s), while pair 1 records `T-E32-03-D3-high` red. **Red on main: no**. [Control log](evidence/remote-main-functional-control.log). The pair 2 full-suite result is still pending.

The full gate's typecheck, lint and fresh build pass; its smoke phase passes **6 selected unit checks and 31 browser cases**. The default **1146-row WebGPU matrix is running**, followed by the prescribed browser set. The script's final shell exit alone is not a gate verdict because it prints step results and continues after failures. [Live gate log](evidence/full-browser-gate.log), [smoke browser JSON](evidence/full-gate-smoke-playwright.json).

`T-E01-01b` passes on the unchanged main snapshot (129.8 s), while pair 1 records a red at 187.4 s: **red on main: no**. The final candidate's separate typecheck/lint/build are green; the full-suite test's exact failure detail is pending its JSON.

The E24 verify additionally records `T-E24-09-evade` red after ~20.4 minutes. Pair 2 also records `T-E32-32` continuous L1–L10 and `T-E31-20` continuous L1–L9 red after ~39–40 minutes each. Fresh main campaign/protection controls are running against the preserved remote snapshot; their exact failures and attribution are pending. No completion or rescue criterion is relaxed.

The waiting main-weather/L8 quiet reservation was released **before any test started**, after about four minutes, rather than hold an unused browser slot throughout the full catalog. The comparison and L8 remeasurement remain unmeasured until the gate releases its browsers and a quiet reservation is available. [Deferral record](evidence/native-control-deferred.json).

Main's continuous L1–L10 control passes **through credits**, with all ten real handovers (712.4 s wall time). Candidate continuous L1–L9 and L1–L10 artifacts both contain **only seven level reports**: L6 completed at 267.87 s with zero deaths, then **L7 times out at 1200 s in `bus-departure`, phase `boarding`**, with most carried followers at `(-74.4, 47)` and none of them marked passed. The candidate `T-E32-32` red is therefore **not red on main**; its observed blocker is L7 boarding, not the L10 cure fight. [Candidate L10 artifact](evidence/l10-campaign-candidate.json), [candidate L9 artifact](evidence/l9-campaign-candidate.json), [main control](evidence/remote-main-campaign-control.log). The independent L1–L9 main control is still running.

E24 evade-only candidate evidence: timeout at 600 simulated seconds, 15 player deaths, zero attacks, 13 lost survivors and **16/29 potentially rescuable (55.2%)**, above the unchanged 30% rescue ceiling. [Raw protection report](evidence/l6-evade-candidate.json). Its main protection control is pending; this fixture's intended failure is surviving too many followers without fighting, not the strict route's zero-death assertion.

The consolidated [observed-red inventory](red-tests.json) records per-test main Yes/No only from actual controls, and marks unfinished controls Unmeasured. It includes both weather tiers, both WebGL zoo clipping rows, and the mobile escape/elephant charge browser failures already reproduced on main.
