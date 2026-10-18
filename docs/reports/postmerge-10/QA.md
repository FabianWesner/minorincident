# Postmerge 10 QA

Source starts at `5a2ea113c` on `lane/merge-batch10`. Browser cap `68f83ae44` was cherry-picked first. No deployment or merge into main.

## L6 cause and fix

The shared room mask from `c94e343d6` changed crowd routing/pursuit and the retreat balance. Its polygon loop also ran all 27 excluded polygons at each 20 cm visibility/steering sample. An ablation removed only that mask and retained wave3's strict offscreen spawn selection: complete/newbie/evade/side-entry tests all passed. [Ablation log](evidence/ablation-no-room-mask.log).

Replacing the polygon loop with indexed exact rectangle bounds recovered runtime but reproduced the same 8/29 newbie rescue count and 16/29 potentially rescuable evade count. This separates the CPU cost from the gameplay regression. [Indexed shared-mask experiment](evidence/fast-room-mask.log).

The final fix applies that indexed floor mask to player route planning and raw movement. Crowd navigation retains its previous domain; player routes still reject the empty strip beside the first gate. Existing live blocker forwarding and rebakes retain the player mask. A new unit regression covers this; the original floor/gate route assertions now query the player grid. No rescue bands, timeouts, breach rule or L5 enemies changed. `src/assets/staticCollision.ts` has no change from the supplied tip. Against main, its inherited differences are 22 source-hash refreshes from `c6765c8a4`; collision boxes are identical. No collision rebake/churn was introduced by this job.

Focused final-source sim: **15/15 pass**. Complete rescues **24/29**, newbie **12/29**, both with zero deaths; evade leaves **5/29** potentially rescuable. Complete/newbie run in **21.76/21.26 s**, side-entry in **3.36 s**. [Results](evidence/player-room-mask-vitest.json).

Strict keyboard/mouse browser: **5/5 pass**, **27/29 rescued, zero deaths**, seven photographs and physical L7 carryover checked. This exceeds the previous strict 23/29 result. [Browser log](evidence/l6-premerge-browser.log), [result and photographs](evidence/l6-premerge/real-input.json). A second run on the fully merged build also passes **5/5**, with the identical **27/29, zero-death, 267.02 s** strict result. The final post-RNG-fix continuation repeats the strict input result **27/29, zero deaths, 267.02 s**: [final result and captures](evidence/l6-after-rng/real-input.json). [Final browser log](evidence/l6-final-browser.log), [final result and captures](evidence/l6-final/real-input.json).

Idle Hetzner rerun, with both runner slots reserved to exclude concurrent jobs: Alpha 200 p95 **2.457 ms**, L9 resident 200 p95 **2.037 ms**, each budget **4 ms**. [Log](evidence/idle-perf.log), [Alpha](evidence/idle-alpha-200.json), [L9](evidence/idle-crossing-200.json). The earlier 4.89 ms L9 observation overlapped the diagnostic L6 run; no budget was changed.

## Requested candidate-red dispositions

All were **red on main: No** in the supplied matched controls; all now pass without threshold/timeout changes.

| Case | Fully merged measurement |
| --- | --- |
| L6 complete bot slowdown | 23.75 s wall, versus reported 1,049 s |
| T-E24-03 newbie | 12/29 protected, zero deaths; 22.97 s wall |
| T-E24-09 evade | 5/29 potentially rescuable; assertion passes |
| E24-PO35 side entries | 4.37 s wall, original 30 s timeout |
| T-E31-20 L1→L9 | pass, 576.68 s wall |
| T-E32-32 L1→L10 | pass, 689.22 s wall |
| Alpha-200 / L9-S4-200 | idle p95 2.457 / 2.037 ms, original 4 ms limits |

[Final full-sweep results](evidence/pair2-vitest.json); [idle timing evidence](evidence/idle-perf.log). Complete/newbie rescue counts and evade potential are from the focused final-game-source runs; the full sweeps repeat the original policy assertions.

## Integration

Merged the requested exact tips: APC/sedan `28c129d3f`, vehicle see-through `ccda7d718`, VFX round 2 `e5965cc33`. Package matrix filter conflict resolved by keeping both sets of registrations. Existing blast warmup and the new vehicle occluder call were retained. Remote suites run against private snapshots after the vehicle pair and after VFX; the first completed before the second suite was admitted. An earlier second-suite admission hit its 30-minute cap without starting tests; its log is retained, and the retry began only after the vehicle suite finished.

Final typecheck/lint/build pass. New `qa-l6-nav-shelter-mouth` scene and `vfx-*` are registered in the default catalog. Focused final matrices include all VFX scenes, all `seethrough-apc-*`, APC contact, and the L6 mouth/gate/floor edge scenes, both tiers and zooms 1.5/1/0.5 on both backends.

## Final focused matrix and native budgets

Before the subsequent warmup RNG fix, **192/192 focused views pass:** [combined summary](matrix/final-summary.json), [WebGL2 initial index](matrix/webgl2/index.md), [six corrected fixture reruns](matrix/webgl2-recheck/index.md), [WebGPU index](matrix/webgpu/index.md). Actual quality tiers match requested tiers. [Counter peaks](matrix/counter-peaks.json): high **140 draws / 246,647 triangles**, low **126 / 75,223**, within E18; these functional captures are not quiet GPU timings.

After `0caecab8d`, the final focused matrix passes **204/204**: [summary](matrix/final-after-rng-summary.json), [WebGL2 102/102](matrix/final-webgl2/index.md), [WebGPU 102/102 extracted from the final full gate](matrix/final-webgpu/index.md). Both tiers and all three zooms pass with zero console errors and actual/requested quality matches. [Final counter peaks](matrix/final-after-rng-peaks.json): high **140 draws / 246,647 triangles**, low **126 / 78,144**, within unchanged E18 limits. **6/6 final native performance tests pass** on headless Chrome/ANGLE Metal Apple M4. [Final log](evidence/native-final.log), [conditions](evidence/native-final-conditions.jsonl), [bounded reservation and release](evidence/native-final/reservation.json). The earlier [6/6 log](evidence/native-perf.log) and [443.25 s reservation](evidence/native/reservation.json) are retained. No uncapped frame-rate flags ran outside `tools/perf/quiet-run.sh`; [live browser process observations](evidence/browser-cap-observations.jsonl) show two ordinary browsers without those flags. The quiet helper also locks legacy slots 2/3 to block older callers, while its command launches only one browser (`workers=1`).

| Native case | High | Low | Required budget |
| --- | --- | --- | --- |
| Blast frame p95 | 7.0 ms | 11.8 ms | 16.7 / 33.4 ms |
| Blast frame maximum | 12.6 ms | 28.4 ms | desktop ≤50 ms |
| Blast sim p95 | 0.6 ms | 2.1 ms | 4 / 6 ms |
| L6 tunnel frame p95 | 8.3 ms | 16.2 ms | 16.7 / 33.4 ms |
| L6 tunnel frame maximum | 44.0 ms | 59.3 ms | desktop ≤50 ms |
| L6 breach2 frame maximum | 18.7 ms | 45.0 ms | ≤50 ms |
| L6 abandon frame maximum | 6.9 ms | 34.3 ms | ≤50 ms |

L6 tunnel loads retain **27 survivors and 40/30 infected**, emergency lighting and the headlamp; low uses the existing phone/4× CPU throttle. Raw measurements and screenshots are in [final native evidence](evidence/native-final/). Low's ordinary tunnel maximum is reported without applying the desktop-only hitch limit; both low transition limits pass unchanged.

## Visual review

Opened the actual L6 shelter, chokepoint and night-exit PNGs. Shelter: warm mat/lantern pools and cool strip lights, visible courier/corgi and readable dialogue. Chokepoint: a dense clothed cohort crossing the service opening, highlighted brace crates, courier remaining on the track behind them; health bars overlap in the crowd. Exit: courier/corgi and last followers on the raised pavement, headlamp pools against dark purple fog and damaged vehicles. The final post-RNG chokepoint photograph repeats the same dense crossing and overlapping bars. The final native portrait shot keeps the courier and headlamp pool readable on the track, with the cohort cropped at the right edge and touch controls inside the viewport. These route photographs include cinematic framing; the Scene Lab follow/game-camera matrix supplies the required game-camera comparisons.

Opened representative game-camera sheets for APC contact (WebGL2 high/zoom 1; WebGPU high/zoom 0.5), truck occlusion (WebGL2 low/zoom 0.5), explosion (WebGL2 high/zoom 0.5; WebGPU high/zoom 1), Molotov (WebGL2 low/zoom 1), and the corrected mouth route (WebGL2 low/zoom 0.5). APC remains level/opaque, the sedan slides ahead and fades when it obstructs the driven subject; the close blast has a large white onset, fragmented orange fireball, black soot/debris, then standing flame and a bounded smoke column. The mouth walk stays on the tracks.

The initial mouth fixture attempted an invalid diagonal into the physical entrance wall and stopped at x31.7. It was corrected to start on the authored track approach; the original x44–46 reach assertion is retained. Its six WebGL2 rows pass on rerun; historical failed rows remain in the first index.

## Remote suite and gate progress

Vehicle-pair full suite: **503 files / 3,138 tests passed**, 3 files / 11 tests skipped, 2,898.76 s. [Log](evidence/remote-pair1.log), [machine results](evidence/pair1-vitest.json). Both continuous campaigns pass: [L1–L9](evidence/pair1-E31-campaign.json), [L1–L10](evidence/pair1-E32-campaign.json). VFX full suite: **502 files / 3,137 tests passed**, one file/test failed only with the diagnosed `ENOBUFS`, 3 files / 11 tests skipped, 2,936.02 s. [Machine results](evidence/pair2-vitest.json). The exact fixed file then passes **6/6**; that test-only correction was checked by the exact file rerun. The later game RNG fix triggers a separate complete final sweep. All game regressions and both continuous campaigns pass in both full runs. The initially capped VFX admission is [retained](evidence/remote-pair2.log); the actual run is [separate](evidence/remote-pair2-retry.log).

The orchestrator replaced the external browser gate after its offloaded SwiftShader smoke stalled under competing GPU jobs. That obsolete run and S-02 timeout are **superseded**, as instructed; no claim of a current candidate regression is based on them. The old gate and baseline control were stopped. The replacement local smoke passes **16/16**, with zero retries/flakes in 90.9 s: [machine report](evidence/gate-local-smoke-playwright.json). The updated [local gate script](evidence/gate-browser-local.sh) was launched with `E2E_PORT=3411 SCENE_PORT=3412 E2E_SLOTS=2`; [local log](evidence/gate-browser-local.log). It builds afresh and uses browser locks throughout. The supervisor caps any quiet reservation at 1,180 seconds and stops a 30-minute period without admission/progress.

## Asset-query tooling correction

The VFX full sweep exposed `runtime-integration` exhausting Node’s default 1 MiB child-process output buffer, **not an asset-status assertion**. The private remote git index includes report artifacts and emitted **1,070,856 bytes**. Direct reproduction returned `ENOBUFS spawnSync git ENOBUFS`; checking the manifest showed no non-integrated asset with both source/runtime paths tracked. [Diagnosis](evidence/asset-query-diagnosis.json).

Commit `0761ff077` makes `git ls-files` query the manifest’s source/runtime paths. Every existing status assertion is unchanged; no timeout or budget is increased. The exact remote file rerun passes **6/6** in 1.47 s: [log](evidence/remote-asset-query.log), [results](evidence/asset-query-vitest.json). Typecheck and lint pass after this test-only change. The completed sweep retains its original failure as historical evidence.

## VFX warmup regression found by the complete gate

The first updated local gate completed its matrix **1,227/1,230** in 4,102.5 s. Two reds are the known zoo-clipping rows. The third is a newly exposed **candidate-only** failure: `qa-l10-title-credits@low-z0.5` has **7 mist puffs** against the unchanged minimum **10**. [Full index](evidence/gate-matrix-index.json), [candidate matched rerun: 5/6](matrix/title-credits-recheck/index.md), [matched main `68f83ae44`: 6/6](matrix/main-title-credits/index.md). Main has **12** puffs in that exact row.

The new `Blasts.prewarm()` fragment called `chunk()` using the same RNG stream as cure mist. Its 11 random draws changed later mist placement and frustum admission. Commit **`0caecab8d`** gives that loading-only fragment a separate RNG; real explosions retain their live stream. The regression now asserts that prewarming leaves the live RNG snapshot unchanged. No mist count, emission rate, pool cap, assertion or budget was relaxed.

Fixed title/credits **6/6 pass**, with **12 puffs** in the original failing row: [index](matrix/title-credits-fixed/index.md). Focused remote VFX/asset checks **49/49 pass**: [results](evidence/prewarm-rng-unit-vitest.json), [log](evidence/remote-prewarm-rng-unit.log). Typecheck/lint/fresh build pass. Refreshed WebGL2 **102/102** and bounded quiet native **6/6** pass. The full final remote sweep after this fix passes **503 files / 3,138 tests**, 3 files / 11 tests skipped, **zero failures**: [log](evidence/remote-final.log), [machine results](evidence/final-vitest.json). The exact final browser gate finishes **1,228/1,230** in 4,091.4 s, with only the two inherited zoo-clipping rows red: [full log](evidence/gate-browser-final.log), [full machine index](evidence/gate-final-matrix-index.json). Its `set -e` exits there; selected e2e and L1 grade/look are continued separately with the same commands, plus final L6 and functional VFX/E27 checks. The final gate smoke passes **16/16**, zero retries/flakes, 88.95 s: [machine results](evidence/gate-final-smoke-playwright.json).

Opened the actual zoo, failed title/credits and fixed WebGPU title/credits sheets, plus refreshed WebGL2 low/zoom 0.5 blast. Zoo shows six small upright costumed civilians on a tan tiled platform; the two clipping detections are not clearly visible at sheet scale. Title/credits shows readable gold title text over the dark industrial compound, pale translucent mist and a complete credits panel; the fixed sheet has a fuller pale veil behind the title. The refreshed close blast retains its white onset, broken orange lobes, dark debris and standing flames. Also opened final WebGL2 high/zoom 1 APC contact, low/zoom 0.5 truck occlusion, high/zoom 0.5 blast and low/zoom 1 Molotov sheets: the APC stays level through the ram, the sedan slides and fades in the contact path, tall-truck bodywork fades while the nearby red sedan remains opaque, and the Molotov shows a bounded orange flame/smoke column. [Opened-sheet inventory](opened-sheets.json).

## Browser continuation and remaining reds

The exact selected gate command, plus final L6 and functional VFX/E27 checks, completes **122/125 passed**, **3 failed**, zero flaky tests, **915.42 s**: [log](evidence/selected-final.log), [results](evidence/selected-final-playwright.json). L6 strict input repeats **27/29, zero deaths**; all six E27 functional checks pass. The three failed cases are lifecycle and the two high-tier gear draw caps.

Fresh main controls reproduce both zoo rows (**4/6** views pass) and lifecycle (**5 versus 2 textures**, both attempts). Main passes both high-tier gear checks (**2/2**). [Every remaining measured red, explicit main Yes/No, and draw-cost diagnosis](red-tests.md).

The final L1 grade/look command was run through the bounded quiet helper exactly as requested: **6 skipped, zero executed**, because both files already use `test.fixme` for the retired L1 diner flow. [Log](evidence/l1-grade-look-final.log), [results](evidence/l1-grade-look-final-playwright.json), [quiet conditions](evidence/l1-grade-look-conditions.jsonl). No skip was added or removed. Active L1 v2 input and its nine-photo browser checks pass in the continuation.

Two candidate-only scene draw-cap reds remain. The read-only probe identifies three ambient GPU meshes / 64 triangles from inherited `e3b6138e7`: total draws are **32 candidate versus 29 main**, including identical 14 shadow draws; the cap stays **30**. There are no live blast effects or stale gear. These atmosphere files are unchanged from the supplied tip. The matched probe and current main-control evidence are in the red inventory.

[All 66 historical cases](historical-red-dispositions.json) retain their prior main controls and current dispositions. The previous storm native measurements remain outside the permitted browser subset and have no matched main classification. The optional 17-config bus-ride battery was not included in the user's restricted browser list; it is unmeasured here. No claim is made that the overall browser gate is green.

## Final cleanup

The sole temporary `/tmp/postmerge-10-control` worktree was removed. Generated tracked `test-results/` changes were restored after copying required evidence here. `src/assets/staticCollision.ts` is unchanged from the supplied tip; [cleanup audit](evidence/collision-cleanup.json) confirms the inherited 22 hashes match the actual sources and no collision geometry differs from main. Protected directories and reference images were not edited.

Controls pin main `68f83ae44`. Main advanced concurrently to `6af482a6b` (local browser gate tooling); `src/` and both compared e2e files are identical between those main commits. This job neither deployed nor merged into main. Full suites used existing Hetzner runners, and browser runs stayed headless with at most two live browsers.
