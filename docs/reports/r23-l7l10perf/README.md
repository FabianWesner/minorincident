# r23-l7l10perf — L7 cold-load gap and L10 first-hit hitch vs PROD

Branch `lane/r23-l7l10perf`, based on main `5cd93f3c`. No push, no deploy. Raw per-load numbers: [summary.json](summary.json).

**Result.** L7 cold load: all four cells are within PROD x 1.05 at 10 paired loads per side on the final code (+3.1 / +4.0 / +0.6 / +0.5 %); the first round, before the audio prefetch, failed one cell (+5.1 %). The L10 first-hit hitch has a diagnosed cause and a fix; L10 worst frame is 33.3-33.4 ms (PROD 33.4-50 ms) in every valid run after the fix. No content was removed or changed.

## Method

Same as r22: PROD = batch 59 rebuilt from `2741447` in one temporary worktree (`npm run build`, entry bundle `index-Dk-iL-FG.js`, identical to the live name; worktree removed at the end). Candidate = this branch, `npm run build`. Both served by static servers with no-cache + ETag and original bytes (the frame runs use the r19 snapshot server, `?testApi=1` adapter only). Native Apple M4 Metal, headless 1600x900 (frames 1280x720), fresh Chrome profile per load (`LOAD_FRESH_BROWSER=1`), `tools/perf/quiet-run.sh` exclusive admission, one browser at a time, PROD and candidate in the same reservation (PROD first). 10 loads per side per L7 cell, 6 per side for the L10 cold-load checks, frame A/B 60 s (L7) / 90 s (L10) per side.

## Findings

L7 (+150-190 ms, all in "Preparing the scene"). The five extra fetches (national-guard skinned LOD0-2, medkit, alpha-worker) are not on the critical path: `view:civilian-crowd` is the same or shorter on the candidate. The cost is warm-up work. Paired phase table (webgl2 high, medians): shader compilation +157 ms, warm-up solo draws +67 ms, driver warm-up +70 ms, atlas upload +20 ms. Node-builder count is unchanged (242 vs 244 builds), so the compile delta is heavier graphs/links across the whole candidate (L1-L4 sit at +1.6..+3.7 % in r22 for the same reason), not new programs.

* **Solo-draw chunk boundary (found).** The solo phase draws `preRenderSolo` batches in groups of 64 (8x8 grid in the 128 px target), two draws and two GPU fences per group. L7 runs the pass twice (vehicle reveal off/on). PROD has 60 solo leaves per pass (one group); the candidate has 66 (+3 guard LOD batches, +3 guard corpse pages) and so a second group on both passes, about +55-66 ms.
* **Serial work after the warm-up (found).** `level:audio` (55 ms: the L7 pickups/weapons banks) and the L7 -> L8 handover prefetch (65 ms: layouts fetch plus a synchronous `DistrictWorld` build) ran after the warm-up, behind the card, in both builds.

L10 (frame hitch). `builds` of the candidate show `pal_static-colors` plus `ShadowMaterial` for a 9-attribute static group (`_placement0-3`, `_placementColor`, `_occluder`, 3324 vertices, one instance) linking at tick 68020 (~74 s). The stack at creation of that geometry is `GameView.updateFrame -> DistrictView.syncDestruction -> DestructionView.extract -> new InstancedGroup`: it is the sliced batch of the first damaged destructible prop. `DestructionView`/`world.destruction` do not exist in PROD, which is why PROD has no such late build. The hitch is intermittent (83-100 ms in 2 of 4 candidate runs; the link happens in all of them).

## Changes

1. `PreRenderer.preRender(..., sharedCorpseSolo)`: for L7 the solo phase draws one corpse page per frozen-material + exact vertex-layout key (the same key `warmCandidates` uses, now `layoutKey()`). Corpse pages of one palette share their frozen material and layout, so the first solo draw already specialises the driver program; every page is still drawn in the normal and instanced passes. WebGL only (solo draws do not exist on WebGPU).
2. `Game.prefetchL8()`: the L7 -> L8 handover data is started before `view.load()`; the layouts download runs in parallel and the `DistrictWorld` build waits for `requestIdleCallback` (timeout 1 s), i.e. into the native link waits of the warm-up, and is awaited before the card closes. Same data, same result, `preparedL8` is still set before the level is playable.
3. `AudioService.prefetchL7()`: starts the L7 bank decode (the same cached `registry` loads `load()` awaits) before `view.load()`; no world or graph state is touched, `load()` is unchanged and finds the banks ready.
4. `DistrictView.prewarmDestruction()` (L10 only, called from the load path next to the debris prewarm): extracts the hidden destruction batch of one resident, unprotected object behind the card, with its normal `DestructionView` entry (hidden until damage, revision 0), so the first real hit reuses a linked pipeline. One object is enough: all static props share the `static-colors` batch material. With four objects the L10 webgl2 high cold load went to +8.5 % (baseline main +3.9 % in the same session); with one it is +5.0 %.

## Results

### L7 cold load (10 paired loads per side; rule: median <= PROD x 1.05, every load <= 6000, post-card max <= 200)

| Cell | PROD med (ms) | r22 screen (5 loads) | Round 1 (1-2 only) | Final code (1-3) | Max load (final) | Post-card max |
|---|---:|---:|---:|---:|---:|---:|
| L7 webgl2 low | 2967 | +6.2 % | 3092 vs 2942, **+5.1 % FAIL** | 3058, **+3.1 %** | 3159 | 17 |
| L7 webgl2 high | 3526 | +7.2 % | 3559 vs 3517, +1.2 % | 3667, **+4.0 %** | 3842 | 17 |
| L7 webgpu low | 2774 | +5.0 % | 2808 vs 2708, +3.7 % | 2792, **+0.6 %** | 2826 | 17 |
| L7 webgpu high | 3316 | +4.1 % | 3348 vs 3266, +2.5 % | 3332, **+0.5 %** | 3358 | 17 |

PROD's own first load per reservation on webgl2 high is a 4.6 s cold-shader spike (r22 finding); all candidate loads are below 3.9 s. Round 1 had changes 1-2 only, round 2 (final) adds change 3. The webgl2 cells vary by about 2-3 % between sessions (high: +1.2 % then +4.0 %); both rounds are in `summary.json`. The margin on webgl2 high/low is 1-2 points, so a 20-load qualification is still advisable.

### Frame-time A/B (native WebGPU; p95 / max ms, PROD -> candidate; rule: p95 <= PROD + 1, max <= PROD + 16.8, no new >= 66 ms frame)

| Level | low | high |
|---|---|---|
| L7 (60 s) | 16.7/33.4 -> 16.7/33.4 pass | 16.7/50.0 -> 16.7/16.8 pass |
| L10 (90 s), final | 16.7/33.4 -> 16.7/33.4 pass | 16.7/50.0 -> 16.8/33.4 pass |
| L10 before the fix (r22) | 16.7/33.3 -> 16.7/100.0 FAIL | 16.8/49.9 -> 16.8/83.3 FAIL |

After the fix the candidate has no `pal_static-colors` / sliced-batch build after the loading card in any L10 run (the 83 ms occurrence reproduced once before the fix; the other pre-fix runs had the build without a measurable hitch, so "no build after load" is the stronger evidence than the frame max). The L7 frame runs were taken on round-1 code (without change 3, which does not touch rendering); the L10 runs on the final code. One L10 high run was invalid (foreign CPU work during the reservation, exit 75) and was repeated.

### L10 cold load (6 paired loads per side)

| Cell | PROD med | candidate med | delta |
|---|---:|---:|---:|
| webgl2 high, main without the fix | 3201 | 3326 | +3.9 % |
| webgl2 high, destruction prewarm of 4 objects | 3143 | 3409 | +8.5 % (dropped) |
| webgl2 high, final (1 object) | 3176 | 3334 | +5.0 % |
| webgl2 low, final | 3501 | 3602 | +2.9 % |

The r22 L10 webgl2 high figure (+6.4 %) and r20 (+4.9 %) put the cell around +4-6 % before this lane; the fix does not move it measurably at 6 loads, but it is not improved either. Qualifying L10 webgl2 high remains open (20-load run).

## Validation

`npm run typecheck`, `npm run lint`: clean. `npm test` on the committed tree: 27 files / 107 tests pass (31 s). (A first run on the dirty tree failed `tests/tools/gate-tools.test.ts` because its review-freshness check reads the working tree; it passed once the work was committed.)

## Open

* 20-load qualification of the four L7 cells and of L10 webgl2 high (margins above are 1-2 points on webgl2).
* Remaining L7 delta is the structural cost of 6 extra solo batches plus the candidate-wide heavier graphs; a larger win would need compile overlap with asset loading (start compiling district materials while the crowd still loads), not attempted.
* Other destructible props with different materials (wreck variants) were not individually warmed; no further late build was seen in the L10 runs.
