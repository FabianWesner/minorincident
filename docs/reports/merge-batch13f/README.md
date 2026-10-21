# Batch 13f integration

Baseline: `56d7e7d16` (`lane/fix-13e-l6`). Local integration only; no push, deployment or main merge.

## Group A

Merged `lane/edges-all` (`79c360e26`) and `lane/l8-continuity` (`3e1a11b5c`).

Conflicts: `GameView` keeps survivor ring updates and passes story-shot state to both objective presentations. `ObjectiveMarker` keeps terrain-aware placement, depth-tested ring material and metro completion hiding, adding the cinematic/story suppression. `View.reset` keeps the rocket zoom-limit reset while optionally retaining the handover zoom. `Hud` retains the shared objective wording formatter and clears empty objective text. Both camera test additions are retained.

Typecheck and lint pass. Remote unit/level sweep pending (immutable snapshot at `58a7e600c`).

## Evidence procedure

The sole baseline worktree is `/tmp/mi-merge-batch13f-base`, detached at `56d7e7d16`, with its own production build. Browser checks are headless, use private ports and the shared browser lock, and are serialized within this job. Vitest remote sweeps use at most four workers. Native timing uses `quiet-run.sh` with its existing reservation deadline.

E29 baseline and final selections use the same non-performance E29/smoke pattern and visual exclusion as the original l7-perf functional run. Native WebGPU checks remain headless and separate from remote software rendering.

## Group B

Merged `lane/world-fill-l8-l10` (`0c7af367b`) and `lane/weapon-keys` (`9534f96e5`), group tip `1d559bc36`. Typecheck/lint pass; remote sweep pending.

Generated D-CURE JSON/GLB conflicted with the 13e route-corner clearance fix. Rebuilt from the automatically merged authoring source, preserving the overshoot clearances and new dressing, through the normal Blender/compression/streaming pipeline (`tools/layouts/build.ts D-CURE --force`, source hash `5e6fec72f7179de8e45ce354073a2e384ae5302a7ebeab37acd21ebc438ca278`). Kept incoming L10 neutral road color/grade distinction; unioned Scene Lab filters. HUD constructor retains navigation/weather grouping and adds the weapon rack; both CSS additions remain. The incoming low-tier arrival pin remains 143.4833 s with its 135–145 s band unchanged.

## Group C

Merged `lane/level-load` (`03691d243`) and `lane/l7-perf` (`eecb39eb1`), group tip `a50388e5c`. Typecheck/lint/build pass; remote sweep pending.

`CrowdView` retains completed batch caching and uses paced L8 bakes on misses, retaining the incoming yield points, upload prefixes and static rig uniforms. `Game` retains L4 alarm warmup alongside L8 prepared navigation/loading presentation. The optional prepared district follows the existing reserved-ID parameter, preserving L9 identity reservation; the handover equivalence tool passes its argument in that position. `EventBus` keeps `cloneData` as the default copy while retaining the new scalar-copy hook and listener snapshots. `HealthBars` retains follower selection plus projected-top computation and partial uploads.

The repository contains no dedicated level-load prose report or world-fill prose report at the requested paths. Read the level-load commit notes and handover tooling, the world-fill comparison sheet, the continuity report, weapon-key README, edges report and l7-perf README/evidence.

## E29 baseline

Fresh native baseline `56d7e7d16`: **18 passed / 17 failed**, 35 tests, 8.8 min. Five checkpoint assertions expect `corridor` but remain at `rocket` (four entry variants plus touch). Twelve night contrast cases fail courier clipped-pixel-share checks. Both trapped-straggler departure cases, focus/Resume, full real-input route, Fairhaven pairs and five WebGPU smoke cases pass. See [baseline-E29.json](baseline-E29.json). This differs from the older l7-perf remote 18/13 outcome; the fresh identical-environment comparison is authoritative for new failures.

## Focused integration checks

Remote prepared/fresh L8 comparison: 22 exact snapshots, high/low over 600 ticks per tier. Regenerated L10 arrival tests: 2/2 pass, retaining both pins and the 135–145 s band.

## L8 capture repeat

All four fixed-tick L7→L8 gameplay captures (WebGL2/WebGPU, high/low, tick 180) are exactly RGB-identical and have identical entity censuses: [counts](l8-pixels.json). Reviewed original level-load high WebGPU page captures at tick 120: only the newly requested numbered weapon rack changes, within x=20–248/y=828–884. The courier outfit/pose, gathered survivors, APC lights, paving shadows, lamp and camera are unchanged. [Side by side](load-comparison.jpg), [original capture summary](load-comparison.md). These are pixel-mode observations; their load durations are not isolated timing acceptance measurements.

## Initial L7 visual investigation

The first 24-frame comparison has 16 exact pairs. A 1,026-pixel low-WebGPU settled horde difference affects two actors' planted poses; the unchanged pre-performance repeat reproduces exactly the same 1,026-pixel difference, while its simulation remains identical. Thus this horde difference is an existing render-history variation, not attributable to the performance merge. The unchanged repeat also changes 1,869/1,319/1,413 pixels in low-WebGL rocket frames, whereas those initial merged pairs were exact. Rocket hats show existing overlap/order variation; further ordering diagnosis is pending. All entity/health/transform/corpse snapshots match. Every pixel is counted without masks/tolerance.

Initial crops were opened and inspected: the horde difference is around two bodies/feet beside the courier; the high rocket differences outline several cap/hat rims within the crowd. The blast flash, outward effect, crowd placement and ground remain visually unchanged. [Full comparisons](l7-initial-comparison.jpg), [crops](l7-initial-crops.png), [initial counts](l7-pixels.json), [unchanged control](l7-control-pixels.json).

## Hat overlap correction and final visual review

`06360a7a7` assigns accessory batches `renderOrder = 1`: coplanar cap/skull overlap no longer depends on asynchronous material creation order. Geometry, pose calculation, tier policy, capacities and performance optimizations are retained. A diagnostic applied that same order to the pre-performance build; it reduced the formerly 3,162/2,766/3,095-pixel WebGPU rocket differences to 3/75/3. With the product fix, final comparison is 0/74/2 pixels (maximum channel deltas 0/10/8); these residual differences are not visible in the opened side-by-side sheet. All comparison pixels are retained and counted; no image mask, tolerance or assertion was introduced.

The final horde view matches the unchanged repeat's visible pose, including the two actors beside the courier; its difference from the first baseline is therefore pre-existing render-history variation. The courier, crowd density/clothing, hat silhouettes, flash, smoke and ground are retained. [Final opened review sheet](l7-final-review.png), [final ordered comparison](l7-final-order-pixels.json), [ordering diagnosis](l7-order-pixels.json). Strict RGB equality is not claimed for every frame: the nonzero counts and unchanged-build controls are reported explicitly.

The original level-load capture repeated with the numbered rack present on both trees is **exactly identical for L7 and L8 high WebGPU, all 1,440,000 pixels**: [comparison](load-groupB-comparison.md). The earlier 0.28% uncertainty does not reproduce in this controlled comparison.

## Gate progress

Initial merged smoke: 31/31 pass (one worker to honor the one-browser rule). Final post-correction build/typecheck/lint pass. Final smoke/level/E29 pipeline and post-correction remote sweep are pending.
