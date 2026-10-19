# Merge batch 13a QA

Starting main: `2d5e0fb84`. Integration branch: `lane/merge-batch13a`.

Merged in the requested order: camera `6995507ee` (fast-forward), character RCA `b89255edc` (`7fe867752`), controls/content `70c8bd255` (`14c0e973f`). The sole merge conflict was `package.json`: retained both lanes' scene filters and added `camera-hotfix-*` to both default matrix commands. Scene Lab implementation/input merges were automatic. No unrelated `staticCollision.ts` changes.

The incoming controls lane updates criteria for the explicit PO decisions (bicycle WASD, ±35° on-screen auto-aim, 15-second evacuation, same-tick pickup/alarm); these are requirements corrections, not relaxed gates. No additional spec changes were made during integration.

## Direct functional evidence

[Focused browser log](focused-browser.txt): **20/20 pass**, headless native Mac browser, fresh production build, one worker under `tools/e2e-lock.sh`. Includes eight real keyboard aiming configurations, four in-mission L4 camera/HUD configurations, L3 closure/countdown and seven E18 deterministic counter cases. Actual backend and quality are asserted by the camera/aim checks.

[L4 camera samples](game-camera/summary.json): hide objective active at `(-56.23, 32.11)`, both backends and both quality tiers, all three zooms. All twelve measurements give **54°** polar; radii are **9.5 / 19 / 28.5 m** at zoom **0.5 / 1 / 1.5**. The camera test steps another 120 ticks after each sample to check for a snap back. Full framing records and PNGs are retained under [game-camera](game-camera/).

The existing [same-tick pickup regression](../../../tests/levels/controls-content.test.ts) asserts, for both tiers, that `pickup.collected`, `l4.firstTurn` and the first `l4.wave` all use the pickup tick; `gunAt === turnAt`, `warAt === world.tick`, and checkpoint `turn` survives the objective completion. Full remote sweep results below establish execution of this regression.

[Opened images and descriptions](visual-review.md) include the requested tier-4 female sheet, attached dog legs, the real hide camera capture and the L3 evacuation sheet. Numeric sample summaries accompany the final scene results.

## Gate records

- [After character merge CPU sweep](remote-after2.txt): unit + sim + `tests/levels`, Hetzner, at most four Vitest workers, isolated private source snapshot before the controls merge.
- [After controls merge CPU sweep](remote-after3.txt): same suites and worker cap on the final merged sources.
- [Orchestrator browser gate](gate-browser.txt): exact requested script, ports 3661/3662, fresh build, headless, shared browser wrappers.
- [Focused WebGL2 matrix](touched-webgl2/index.md) and [remaining gear tiers](gear-webgl2/index.md): high/low × zoom 0.5/1/1.5.
- [Bus ride regression](bus-ride.txt): required 17 cadence/backend/tier configurations.

Final counts and red classification are appended after the runs finish. A started or queued command is not a passing gate.

## Browser admission waiver

`tools/e2e-lock.sh` now accepts an optional positive `E2E_ADMISSION_TIMEOUT_SECONDS`; its default remains 1,800 seconds. This implements the explicit admission waiver for the requested orchestrator gate without bypassing the two-browser cap, WindowServer sampling, shared locks or cancellation cleanup. `quiet-run.sh` retains its 30-minute admission and 20-minute held-batch limits. The initial gate attempt retains its original deadline; a waived retry, if needed, is recorded separately. `sh -n tools/e2e-lock.sh` passes.

## Completed focused runs

- WebGL2 touched matrix: **90/90 pass**; remaining courier tiers 0–3: **48/48 pass**. Both quality tiers and all zooms 0.5/1/1.5. [Compact numeric records](scene-proof-webgl2.json) retain actual backend/tier, sample counts, attachment/tongue/limb values and render counters.
- All tier-4 female/male rows: sampled attachment count **0**. All dog rows: limb gap **0 cm**. Both corgi scenes: idle tongue-out frames **0**, moving tongue-in frames **0**, with nonzero idle/moving samples.
- Focused matrix E18 maxima: high **117 draws / 462,825 triangles**, low **113 / 337,863**. These are deterministic render counters, not native frame timing.
- [E18 reference counters](e18-counters.json): all seven pass. L5 low female/male **487,343 / 491,999 triangles**, below the unchanged 500,000 cap; draw count 243. Original tracked `test-results/epics/E18` artifacts overwritten by the test were restored after retaining these fresh compact records.
- [Bus ride](bus-ride.txt): **17/17 pass**, both backends/tiers and 60/120 Hz, uneven 120 Hz, 30 Hz, uneven phone cadence.

The initial orchestrator gate stopped before smoke admission after its stock 30-minute wait. The [waived retry](gate-browser-final.txt) uses ports 3661/3662 and `E2E_ADMISSION_TIMEOUT_SECONDS=7200`, from a sparse checkout of the identical game commit `14c0e973f` with the admission-only wrapper change copied in. Public assets, authored assets, layouts and documentation fixtures are shared read-only from this lane, and the retry has its own fresh build output. Its source includes all tests/tools/specs required by the script; source sparsity does not change selected tests or matrix filters. A failed full temporary checkout exhausted disk; Git cleaned it up, and the disposable main checkout was removed after its remote job had taken a private snapshot, recovering about 3.6 GB.

## Disk cleanup steering

On the explicit disk-critical instruction, removed the full verifier checkout and its dist, leaving exactly one `/tmp` worktree (the sparse gate checkout). The verifier wrapper was stopped before it could launch further local phases; its already-running remote CPU child continues from the private runner snapshot. Removed finished camera/browser output folders, the synced local source-comparison archive and all raw completed WebGL metric snapshots after retaining compact proofs and reviewed captures. No further worktree or dist copy is created. Free disk increased to approximately 11 GB immediately, then 17 GB as other cleanup completed. Active browser artifacts are pruned when their stages finish.

## Functional battery and stage cleanup

[Required functional battery](gate-functional.txt), [JSON results](gate-functional-results.json): **108/108 pass**, one worker under the shared lock. This is the orchestrator's full functional selector, including L10 additions, run separately to use a single slot. The real-input alarm case asserts `warAt === gunAt` after taking the gun; [fresh alarm record](alarm-visible.json) and [opened capture](alarm-visible.png) retain the visible-infected follow-up. Together with the focused camera/aim suite and bus suite, the completed browser selections have no failures.

After the stage finished and its preview server closed, retained the result JSON and one alarm capture/record, restored overwritten tracked baseline artifacts, deleted 161.2 MiB of generated test output and removed this lane's completed original `dist` (363 MiB). The sparse gate's active build remains; no new build copy was created. Its remaining browser phases use that existing build.

## After-character CPU result and isolated controls

After-character full sweep: **3,176 passed / 11 timing failures / 11 skipped**, 509 files, 3,312.63 seconds on runner `2.31.10.108`. All functional tests pass, including continuous campaigns. [Compact assertion records](cpu-summary.json) preserve all eleven failures; the raw log remains linked above.

[L9 merged isolated](l9-timing-merged.txt) and [starting-main isolated](l9-timing-main.txt): both **2/2 pass**, unchanged 4/6 ms caps on the same runner. [Starting-main check of all eleven failed timing cases](baseline-timing-retry.txt): **11/11 pass** with both runner slots held. These isolated results establish that the loaded after-character sweep's failures are not reproducible on starting main under isolation; they do not constitute a matched loaded-main run. The after-controls full sweep passes ten of those eleven timing cases, with Zoo S2 remaining red there. Its separate L10 campus-route failure is compared independently.

Comparison scripts restore the exact starting-main `src/` in private runner snapshots, with the unchanged test files. To reproduce, create the transient source archive with `git archive --format=tar 2d5e0fb84 src | gzip > docs/reports/merge-batch13a/main-src.tar.gz`, then run the script through `tools/remote/run.sh` and `tools/remote/timing-isolated.sh`. The local archive was removed once synced; it is not a committed artifact. The first baseline command lacked this ignored archive and ran no tests; its setup failure is retained in `baseline-timing.txt`, and the corrected run is `baseline-timing-retry.txt`.

The after-controls sweep has now executed both same-tick pickup/alarm tests successfully (high and low), plus the tank/concealed-exit regressions and all three controls sim tests. The exact event-list assertions establish that pickup, alarm and first wave use the same tick, with no duplicate wave on the following update.

## After-controls CPU result

Full sweep: **3,194 passed / 2 failed / 9 skipped**, 511 files, 3,936.33 seconds on `94.130.181.173`. Both failures are timing assertions: Zoo S2 200-actor p95 **4.041137 ms / 4 ms**, and the L10 campus-route high p95 **5.464806 ms / 4 ms**. The latter passes its route/checkpoint/death assertions before failing the final p95 check at line 59; it is not a failed route completion. All controls pickup-tick tests and all complete campaign handovers pass. The unlisted L10 timing red is retained for the isolated merged/main comparison rather than classified as inherited without evidence.

[L10 campus-route comparison](l10-route-comparison.txt): **merged 1/1 pass, starting main 1/1 pass**, unchanged route/death/checkpoint checks and p95 ≤ 4 ms. Merged test duration 30.55 s, main 32.80 s; these are whole-test durations, not p95 values. The full sweep's 5.465 ms p95 miss is not reproduced. The isolation wrapper held both slots through the merged test, then automatically released the extra slot upon its functional-project report; the subsequent main run passes in the same private job, but is not claimed as a second fully reserved timing run. No repeated run was used to relax a limit or discard the original red.

## Completed backend matrix

[WebGPU matrix](touched-webgpu/index.md): **138/138 pass**. Combined with the WebGL2 passes, **276/276 unique backend/tier/zoom rows pass** for every touched camera, gear tier 0–4, corgi tongue, dog limb and controls scene. [WebGPU compact proofs](scene-proof-webgpu.json) retain actual backend/tier, nonzero sampling, all attachment/limb/tongue values and E18 counters. Both backends give the same maxima: high **117 draws / 462,825 triangles**, low **113 / 337,863**. Every requested courier attachment count, animal limb gap and idle tongue-out count is zero. The completed WebGPU raw metric files were deleted after writing this compact proof, as required by the disk cleanup instruction. Reviewed sheets are retained.

## E22 selected CPU verification

The remote CPU phase of `MI_VERIFY_REMOTE_SIM=1 npm run verify -- E22` completed **117/117 selected tests passed**, zero failures; 3,088 unrelated tests were excluded by its name filter. [Compact selected-test record](e22-cpu-summary.json), [raw phase log](verify-e22-retry.txt). The small output directory recreated by the remote pull was removed immediately after this compact record was written. The enclosing verifier was stopped during the required disk cleanup, so this is explicitly a successful CPU phase, not an exit-zero claim for the whole verifier.

## Native timing admission

[Native WebGL request](native-webgl.txt) ended **exit 75** after exactly the permitted 30-minute quiet-run admission wait. No timing test ran and no native result is claimed. The orchestrator subsequently paused the other lanes and explicitly requested a fresh T-E22-20 measurement in that quiet window. The [new WebGL request](native-webgl-window.txt) is queued between smoke and the full matrix, under the unchanged 30-minute admission and 20-minute held-batch limits. WebGPU native timing remains explicitly unmeasured. The existing native L4/L7 low timing reds remain inherited baseline items. This follows the binding fairness instruction; it does not change the orchestrator gate's separately granted admission waiver. All deterministic E18 counter and touched-scene budget evidence above remains valid, but native frame/sim budget certification is incomplete.

## Requested quiet-window L4 remeasurement

The orchestrator explicitly paused the other lanes and requested this additional batch. [Native WebGL log](native-webgl-window.txt), [preflight](native-webgl-window-conditions.jsonl): all four legacy slots held, load **2.92**, zero other headless browsers/local Vitest; **2.5 minutes** held, then released. No second native batch was chained. Gate smoke admitted immediately afterward; the parent gate was resumed automatically.

**High passes** every unchanged T-E22-20 limit: pickup/turn window max **31.4 ms / 50 ms**, tank **13.7**, line break **28.2**, war/collapse p95 **9.4/11.2**, sim p95 **2.3 ms**. **Low fails** at collapse median **34.2 ms / 33.33 ms**; its retained measurements also miss pickup/turn **110.9 ms / 80 ms** and line break **83.6 ms / 80 ms**. The latter assertions are after the first failed assertion; these additional misses are derived from the saved measurement against the unchanged test limits. Low sim p95 **5.9 ms / 6 ms** and war median **25.7 ms / 33.33 ms** pass. All draw/triangle/awake-prop counters pass (high maxima 351 / 662,852 / 0; low 198 / 263,124 / 0).

The pickup timing is the maximum rAF interval over the existing test's pickup/turn window, not a claim that the single pickup tick took exactly that duration. Same-tick pickup/alarm/wave equality is separately proven by the passing event assertions. Camera-lane native WebGL low previously measured turn **84.4**, line break **109.7**, collapse median **35.3 ms**; both runs remain reported as red. WebGPU native timing was not remeasured in this batch. Both full timing records and three reviewed captures were copied into [native-webgl-window/](native-webgl-window/), then the completed raw perf and Playwright trace directories were removed.

## Exact gate progress

Fresh typecheck, lint and production build pass. [Smoke summary](gate-smoke-summary.json): **16/16 passed**, no retries, **1.6 minutes**, two workers. Full WebGPU matrix admitted next: **1,548 rows**, 774 per tier. Its compact per-row checks are archived before deleting bulky raw telemetry; completed smoke output directories were removed after saving the result record.

## New full-matrix cut regression

`seethrough-behind-building-l4` high zoom **1.5 / 1 / 0.5** fails the unchanged outside-disc limit 0 with **420,498 / 443,833 / 133,348 pixels**. The [batch-12 control](seethrough-baseline-summary.json) passes all six tier/zoom rows at outside 0, so this is classified **red on main: no**. Source `625d5aa6e` adds `lensPlacements` and the shader foreground-clear mode for an enclosing facade; unlike the normal bounded cut, that mode intentionally changes foreground pixels beyond the courier disc. The newly fixed uncontracted lens can be enclosed by the building at this existing fixture. The opened high-z1 sheet shows the whole courier and corgi on the night street with nearby facade windows and a normal oblique camera; it does not show a flat facade viewport. This remains an unresolved numerical contract regression. No test/limit was relaxed and no facade-clear restriction was introduced that could reverse the urgent playable-camera fix.

The `seethrough-building-first-frame` variant also fails at all three high-tier zooms with the identical outside pixel counts; its six batch-12 rows also pass. Both fixture variants are included in the baseline summary and the same new-regression row of the red table.

Known convoy cut reds reproduce at high z1.5 / z1: **195,856 / 122,917 outside pixels**, versus batch-12 merged **3,244 / 510** and its fresh main **3,204 / 412**, unchanged limit 0. Classified red on main **yes**, while explicitly retaining the substantial increase rather than presenting it as unchanged baseline behavior. The enclosing-facade shader can widen the cut for this camera as well.

The behind-building low-tier rows also fail at all zooms: z1.5 / z1 / z0.5 outside **387,193 / 440,204 / 129,559**, limit 0. Opened low-z1: matching oblique street composition, intact courier and companion, foreground facade windows, curb/lamp and road. The broad foreground clearing and failed bounded-disc contract persist on low quality.

## Authorized PO #25 baseline update

The orchestrator explicitly accepted the intentional facade clearing and instructed this lane to rebaseline only the two named L4 fixtures after visual review. Opened **all twelve** sheets (two variants × both tiers × all three zooms), including frame 0. Street/curb/lamp and courier/corgi remain readable; no flat roof viewport or missing courier appears. Updated only those fixtures' outside-cut ceilings from 0 to **450,000** at the existing **960×540 catalog viewport**, above measured maximum **443,833**. Open-frame, inside-cut and first-frame courier-share checks remain intact. Performance budgets and other cut fixtures are unchanged. This fixes the now-wrong zero-outside criterion for the enclosing-facade behavior approved in PO #25; no other specification criterion changed.

[Accepted baseline record](accepted-facade-baseline.json): **12/12** original measurements pass their revised fixture checks. This is an explicit post-review re-evaluation, not a second full matrix execution; the original raw failures remain in the log/index. All twelve opened sheets are retained in `full-matrix-reviewed/`. The earlier “unresolved contract regression” entries above are measurement history superseded by this specific authorization. Convoy remains outside this acceptance pending the targeted camera comparison.

New convoy low-tier outside-cut failures: z1.5 **205,216**, z1 **122,571**, limit 0. Both batch-12 low rows pass, so red on main **no**. The single-scene camera comparison includes both tiers to investigate these as well as the worsened inherited high reds. Convoy criteria are unchanged.

## Full exact gate completion

[Full row result](full-matrix-index.json), [summary](full-matrix.md): **all 1,548 rows measured**, **1,531 raw passes / 17 original failures**, **5,655.483 s (94 min 15 s)**, two headless WebGPU browsers, both tiers and zoom 0.5/1/1.5. The matrix completed within about 22 minutes of the orchestrator's ETA/45-minute instruction, so no partial stop was needed. Twelve failures are the explicitly accepted PO #25 L4 fixture baselines, leaving **five unresolved rows**: convoy high and low at z1/z1.5, plus known APC low-z0.5. Raw index/log remains unchanged; the revised-baseline acceptance is a separate record.

The exact script exits **1 at the matrix** and does not reach its later functional/L1 phases. Its exact functional selector had already passed **108/108** against the same merged game source in the separate saved run, plus **20/20** focused and **17/17** bus-cadence cases. No L1 grade/look timing result is claimed for this attempt. All row-level checks and compact measurements were saved; only the 17 baseline/failure contact sheets were retained from this run. The completed 100+ MB raw scene-catalog directory was deleted immediately, and the targeted comparison reuses the existing build.

## One targeted convoy camera comparison

[Comparison summary](convoy-camera-comparison/summary.json), [full sampled poses/pixels](convoy-camera-comparison/comparison.json), [log](convoy-camera-comparison.txt), [reproduction script](convoy-camera-comparison.ts). One targeted batch, one scene (`seethrough-scripted-convoy`), high/low at zoom 1.5/1, old/new camera methods; **one headless WebGPU browser at a time**, shared admission wrapper, existing fresh build, ports 3671/3672. The script copies to `tools/qa/batch13-convoy-compare.ts`; invoke with `BATCH13_COMPARE_OUT=<report-directory> SCENE_SERVER=preview SCENE_PORT=3672 E2E_PORT=3671 E2E_UNITS=1 sh tools/e2e-lock.sh npx tsx tools/qa/batch13-convoy-compare.ts`.

The control bundles the **exact `2d5e0fb84` View implementation**, restores its district camera-solid registration and its legacy seated-convoy flag, and calls its update on the existing rig. The merged renderer/assets stay identical in both cases, isolating camera behavior. Shared framing source is asserted byte-identical to main. All sampled old/new positions and targets match exactly (**maximum delta 0 m**); every actual polar sample is **54°** and every sample is seated. Outside-cut maxima also match exactly: high z1.5 **195,856**, high z1 **122,917**, low z1.5 **205,216**, low z1 **122,571**.

**Conclusion: the increase is not steeper polar framing.** The new lens-foreground clear in `625d5aa6e` changes facade rendering beyond the disc even with the old camera. Opened **all eight** old/new sheets. Through frames 300–540, the near facade becomes a stippled cutaway; the bus roof/body/wheels remain readable, other convoy vehicles remain whole, and the roadway/turn stay legible. No new vehicle occlusion or broken vehicle draw was seen. Visible-share checks pass in every comparison (**64.9–83.6%**, unchanged minimum 60%). This is an actual broader foreground reveal, not an accepted camera-framing explanation; the convoy outside-cut criteria remain unchanged and red. The two new low rows are explicitly reported, rather than folded into the inherited high reds. No additional full matrix or camera-narrowing change was made.
