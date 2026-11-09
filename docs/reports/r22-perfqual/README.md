# r22-perfqual — overnight performance qualification

**Result: NOT QUALIFIED.** 0/20 cold cells are qualified at the required 20 loads per side (only a 5-load screening fitted the night); the screening passes 15/20.
Frame-time A/B: 20 of 22 level/tier rows pass without changes; the two L8 and L10 rows that failed are explained below (L8 fixed, L10 open).
qa:threat does not finish inside 600 s on a runner (timeout, same as r20).

Branch `lane/r22-perfqual`, based on main `be421c97`. Commits: `941e92ce` (L8 corpse warm-up), `705f6074` (threat profiling tool). No push, no deploy.

## Method

- Candidate: main `be421c97` (+ the L8 commit for the post-fix rows). PROD control: batch 59 rebuilt from `2741447` with `npm run build`; its entry bundle `index-Dk-iL-FG.js` has the same name as the live https://minor-incident.com bundle.
- Both builds are served by the same static server (no-cache + ETag, original bytes, no test hooks) for cold loads; the r19 snapshot server (`?testApi=1` adapter only for frame runs) for frame A/B.
- Native Apple M4 Metal, headless Chromium 1600x900, fresh Chrome profile per load, `tools/perf/quiet-run.sh` exclusive admission (<= 595 s per reservation), OS page cache warmed for both builds.
- **Screening used 5 loads per side per cell, not 20.** A reservation is capped at 595 s and carries a 60 s cooldown, so 20 cells x 40 loads did not fit the night together with the frame A/B and threat work.

## 1. Cold loads (5 loads / side, ms; rule: median <= PROD x 1.05, every load <= 6000, post-card max <= 200)

Raw: [cold-screen-pre-fix.txt](cold-screen-pre-fix.txt), [cold-screen-L8-post-fix.txt](cold-screen-L8-post-fix.txt).

| Cell | PROD med | Cand med | Cand max | Delta | Post-card max | Verdict (screen) |
|---|---:|---:|---:|---:|---:|---|
| L1 webgl2 low | 2126 | 2159 | 2507 | +1.6% | 33 | pass |
| L1 webgl2 high | 2076 | 2109 | 2742 | +1.6% | 100 | pass |
| L1 webgpu low | 1908 | 1910 | 1958 | +0.1% | 33 | pass |
| L1 webgpu high | 1841 | 1893 | 1908 | +2.8% | 50 | pass |
| L4 webgl2 low | 3242 | 3208 | 3990 | -1.0% | 17 | pass |
| L4 webgl2 high | 3641 | 3774 | 4124 | +3.7% | 67 | pass |
| L4 webgpu low | 3074 | 3089 | 3640 | +0.5% | 17 | pass |
| L4 webgpu high | 3526 | 3624 | 4156 | +2.8% | 67 | pass |
| L7 webgl2 low | 2943 | 3126 | 3242 | +6.2% | 17 | **FAIL (median)** |
| L7 webgl2 high | 3475 | 3725 | 3792 | +7.2% | 17 | **FAIL (median)** |
| L7 webgpu low | 2690 | 2824 | 2825 | +5.0% | 17 | borderline pass |
| L7 webgpu high | 3208 | 3340 | 3406 | +4.1% | 17 | pass |
| L8 webgl2 low | 3078 | 3077 | 6642 | 0.0% | 33 | **FAIL (max 6642; PROD max 6610)** |
| L8 webgl2 high | 3309 | 3424 | 6773 | +3.5% | 50 | **FAIL (max 6773; PROD max 6775)** |
| L8 webgpu low | 3207 | 3174 | 3289 | -1.0% | 34 | pass |
| L8 webgpu high | 3341 | 3406 | 3473 | +1.9% | 50 | pass |
| L10 webgl2 low | 3459 | 3560 | 5610 | +2.9% | 33 | pass |
| L10 webgl2 high | 3109 | 3309 | 5259 | +6.4% | 50 | **FAIL (median)** |
| L10 webgpu low | 3224 | 3276 | 3277 | +1.6% | 33 | pass |
| L10 webgpu high | 2958 | 3040 | 3042 | +2.8% | 33 | pass |

(L8 rows are the post-L8-commit run; the pre-commit run gave the same figures within noise. Pass count 15/20.)

Findings:

- **L8 WebGL2 6.6 s maxima are the first load of each side, identically on PROD** (6610 / 6775 ms): the first fresh-profile "Preparing the scene" in a reservation pays a cold driver shader compile (about 5 s vs 2 s on later loads). The other four loads are about 3.0-3.4 s. The same first-load spike appears in PROD's L7 webgl2 high (7273) and in L10 webgl2 (5.6 s). Under the literal "every load <= 6000" rule, PROD itself fails these cells; this needs a decision (warm-up load per reservation, or measuring p-quantiles) rather than a code fix. Warming the OS page cache did not remove it.
- **L7 +5..7% is real**: all five candidate loads are about 150-190 ms slower than PROD, all of it in "Preparing the scene" (1.69 s -> 1.88 s). A CPU-profile diff (webgl2 low, 2 loads/side) puts +208 ms in the three-webgpu node builder (`NodeBuilder.build`, `_getChildren`: more node-material graphs built). The candidate fetches 5 extra assets that PROD does not (national-guard skinned LOD0-2, medkit pickup, alpha-worker instead of alpha-hoodie), i.e. new L7 content; no content removal was allowed, and I did not find a warm-up reordering in the time available. Open.
- **L10 webgl2 high +6.4%** at 5 loads; r20 measured +4.9% for the same cell. Needs the 20-load run to confirm. Open.

## 2. Frame-time A/B vs PROD (native WebGPU, 60 s per level, L10 90 s; r19 harness, rule: p95 <= PROD+1 ms, max <= PROD+16.8 ms, no new >= 66 ms frame)

Raw: [frames-ab.json](frames-ab.json), [frames-ab-L8-post-fix.json](frames-ab-L8-post-fix.json). Each row is p95 / max ms, PROD -> candidate.

| Level | low | high |
|---|---|---|
| L3 | 16.7/16.8 -> 16.8/16.8 pass | 16.7/16.8 -> 16.7/33.4 pass |
| L4 | 16.7/33.3 -> 16.8/33.4 pass | 16.7/33.4 -> 16.8/50.0 pass |
| L5 | 16.7/33.4 -> 16.7/49.9 pass | 16.7/33.4 -> 16.8/33.4 pass |
| L6 | 16.7/16.8 -> 16.7/33.3 pass | 16.7/33.4 -> 16.7/33.4 pass |
| L7 (+pickup/rocket windows) | 16.7/33.4 -> 16.8/33.4 pass | 16.7/49.9 -> 16.7/16.8 pass |
| L8 (before fix) | 16.8/133.2 -> 16.7/**233.4 FAIL** | 16.8/133.4 -> 16.7/33.4 pass |
| L8 (with `941e92ce`) | 16.7/116.7 -> 16.8/33.4 pass (run 1); 16.7/33.3 -> 16.7/33.4 pass (run 2) | 16.8/33.4 -> 16.8/33.3 pass |
| L9 | 16.7/33.4 -> 16.8/33.4 pass | 16.8/50.1 -> 16.7/50.0 pass |
| L10 (+charge window) | 16.7/33.3 -> 16.7/**100.0 FAIL**; charge pass | 16.8/49.9 -> 16.8/**83.3 FAIL**; charge pass |

Causes:

- **L8 (fixed, `941e92ce`)**: the single worst frame in both builds is the first kill: `corpse_pal_picketWhite` pipeline for a new corpse page links mid-fight (builds log at 24.1 s on PROD, 29.8 s on the candidate, hitch 133 / 233 ms). `CrowdView` already prepares these corpse pages in every scene but shader-warms them only for L7 and L10; L8 now warms them during scene preparation too. After the change the L8 low candidate maximum is 33.4 ms in both runs and L8 high 33.3 ms; cold-load medians are unchanged (-0.0% / +3.5% / -1.0% / +1.9% above).
- **L10 (open)**: the candidate hitch (100 / 83 ms) coincides with the first pipeline build of a `pal_static-colors` (+ShadowMaterial) 9-attribute static group (`_placement0-3`, `_placementColor`, `_occluder`) belonging to the `sunset-grove` district at tick 68020 (74.1 s into the capture; build log 74086 ms, frame 74222 ms). PROD's 90 s window shows no such late build. This is a first-use warm-up gap for a static layout that appears when the courier reaches a later L10 chunk; I did not identify which prop owns that layout in the time box.

## 3. qa:threat on a runner

`node tools/qa/run-threat-remote.mjs` (4 workers, runner 94.130.181.173, slot 0), unchanged tooling: **600.6 s, budget 600 s, exit 124 (timeout)**, 18 of 31 stages started ([threat-baseline.log](threat-baseline.log)). Required: finish with >= 60 s headroom (<= 540 s). Not met, no headroom; same state as r20 (598.97 s best case).

CPU profile of one L5 passive seed (1200 s simulated window, 239 s, `tools/qa/threat/profile-seed.ts`): flat across already-optimised loops: `SpatialHash.query` 27 s self, `EventBus.emit` 16 s self (callbacks inlined; 221 s inclusive), `CharacterSeparation` 12 s, `SimWorld` 10 s, `SolidRegistry.commit` 8 s self / 45 s inclusive, `NavGrid` 24 s over its functions. No single cause; a safe >= 10 % cut would need deeper sim work (contact resolution + spatial hash call counts), not attempted. A cloneData fast path for flat events was tried and dropped (not visible in the profile).

## Validation

`npm run typecheck` on a runner: pass after `941e92ce`. No unit run (only a one-line render warm-up condition changed; orchestrator runs the suite after merge). No visual change: the same corpse pages are warmed, only earlier.

## Open items for the next lane

1. 20-load qualification for all 20 cells (about 45 min of quiet window per 10 cells with the combined-reservation scripts); decide the first-load-after-cooldown rule for WebGL2 (PROD fails it too).
2. L7 scene-prep +150-190 ms (extra national-guard/medkit/alpha-worker graphs): defer/stream those warm-ups or share node graphs.
3. L10 sunset-grove static-colors first-use link (100 ms hitch).
4. qa:threat headroom (needs sim per-tick speedups, ~10 %+).
