# Batch 13f integration

Base: `56d7e7d16` (`lane/fix-13e-l6`). Local branch only: no push, deployment or main merge. Latest code correction: `be570e83f`; final receipts below identify their exact source commits.

## Merge groups

| Group | Incoming lanes | Group tip | Remote unit/level result |
| --- | --- | --- | --- |
| A | edges-all `79c360e26`; l8-continuity `3e1a11b5c` | `58a7e600c` | 2,247 passed, 11 skipped, zero failed |
| B | world-fill-l8-l10 `0c7af367b`; weapon-keys `9534f96e5` | `1d559bc36` | 2,256 passed, 9 skipped, zero failed |
| C | level-load `03691d243`; l7-perf `eecb39eb1` (includes heap-budgets and hitches2) | `a50388e5c` | 2,250 passed, 11 skipped, four timeouts; all four pass isolated |

Typecheck and lint passed after every group. Commands used the requested remote unit/level sweep with four workers. Snapshot durations: A 49.7 min, B 46.6 min, C 71.6 min. The post-hat-correction full sweep at `06360a7a7` finished with 2,252 passed, 11 skipped and two timeouts, both covered by unchanged isolated retries. These raw sweeps are **not reported as zero-failure runs**. [Receipts](remote-suites.json), [A log](evidence/group-A.log.gz), [B log](evidence/group-B.log.gz), [C log](evidence/group-C.log.gz), [post-correction log](evidence/post-hat-full.log.gz).

All four C failures are wall-clock limits under contention, without a failed contract assertion. Exact isolated cases on the final source pass without changing a limit: E17 assets 194.4/300 s, L9 prepared navigation 66.0/120 s, E01 static pipeline 90.2/180 s, standalone L7 audit 159.0/300 s. [Assets](isolated-E17.json), [navigation](isolated-nav-final.json), [static pipeline](isolated-static.json), [L7 audit](isolated-l7-audit.json).

## Conflicts and integration corrections

- **A:** `GameView` retains L5 survivor rings and passes story-shot state to objective presentations. `ObjectiveMarker` combines terrain-aware placement, depth-tested rings, metro completion hiding and cinematic/story suppression. `View.reset` retains rocket zoom-limit reset and optional handover zoom preservation. HUD retains shared objective wording and clears empty trackers. Both camera tests remain.
- **B:** regenerated conflicted D-CURE JSON/GLB from the merged authoring source, preserving 13e corner/overshoot clearance and incoming dressing. Used the normal Blender/compression/streaming pipeline; source hash `5e6fec72f7179de8e45ce354073a2e384ae5302a7ebeab37acd21ebc438ca278`. Kept L10 neutral road grading and the low arrival pin 143.4833 s, unchanged 135–145 s band. Unioned Scene Lab filters; HUD retains navigation/weather grouping plus the new numbered rack and both CSS additions.
- **C:** completed crowd batches remain cached; cache misses retain paced L8 bakes, yield points, static rig uniforms and prefix uploads. Game retains L4 alarm warmup and prepared L8 navigation/presentation. The prepared district follows reserved IDs in `loadComposition`, preserving L9 identity reservation; the equivalence tool uses that argument position. EventBus retains `cloneData` default copying plus scalar hooks/listener snapshots. HealthBars combines follower selection with projected-top computation and partial uploads.
- **`06360a7a7`:** accessory batches use `renderOrder = 1` to stabilize coplanar cap/skull overlap. Keeps geometry, poses, capacity and performance changes.
- **`442ebd6e0`:** cinematic suppression also reaches the base's separate L5 survivor rings; hide/restore assertions added. Focused marker/view tests: 16/16.
- **`be570e83f`:** a role-sharing replacement could dispose a material still borrowed from the new static graph cache by another mesh role. Borrowed graphs now live until cache retirement and dispose exactly once. Regression tests: 3/3 local; focused remote cache/bake/equivalence: 147/147. Typecheck/lint/build pass. Native revalidation confirms L5 returns to eight builds and passes at 83.4 ms in both backends.

No test assertion, budget, image mask, effect population or quality policy was loosened. No dependencies or protected reference/spec directories were changed. Dedicated prose reports were absent for world-fill and level-load; their commit notes, comparison sheet and handover tooling were read alongside the other lane reports.

## Browser gates and E29 comparison

At `06360a7a7`: build/typecheck/lint pass; smoke **31/31**; requested level/browser specs **31/31**. Includes L1/L2, L5 finish, L6 headlamp/quality switch, L7 departure/focus, locked-level debug, objective clarity and weapon keys. Final refresh after cache ownership correction is pending.

Fresh native baseline `56d7e7d16`: **18 passed / 17 failed**. Merged comparison: **19 passed / 17 failed**. **Zero new failure identities**; the additional visible-follower test passes. [Baseline](baseline-E29.json), [comparison](E29-comparison.json), [gate receipts](gates.json), [pre-cache-correction receipts](gates-06360a7a7.json).

The unchanged seventeen reds are four L7 entry variants and touch real-input expecting `corridor` while at `rocket`, plus twelve night-contrast variants with an empty courier ID mask and `NaN` clipped share. Of the older l7-perf run's thirteen failures, departure high/low, focus/Resume, full real-input route and five WebGPU cases pass on both fresh native trees. Its four entry variants reproduce the same baseline checkpoint assertion. The comparison uses identical native selections rather than comparing unlike old runner results.

## Special check: L7 horde and rocket visuals

All fixed-tick entity/health/transform/corpse censuses match. Initial 24-frame comparison: 16 exact pairs. The 1,026-pixel low-WebGPU settled horde difference affects two actors' body/foot poses beside the courier; an **unchanged baseline repeat reproduces exactly that difference**, and the merged pose matches the repeat. This is pre-existing render-history variation.

Opened and reviewed full side-by-side frames and crops. Initial high-WebGPU rocket differences (3,162/2,766/3,095 pixels) outline overlapping cap rims. Applying stable accessory order to both trees reduces these to 3/75/3. With the product fix, the final ordered pre-performance comparison is **0/74/2 pixels**, maximum channel differences 0/10/8: no visible difference in the opened review sheet. Hat silhouettes, courier, crowd density/clothing, flash, smoke and ground are retained. Strict RGB equality of every frame is **not** claimed. Raw counts include every pixel without masking or a new tolerance. [Initial frames](l7-initial-comparison.jpg), [crops](l7-initial-crops.png), [unchanged control](l7-control-pixels.json), [ordering diagnostic](l7-order-pixels.json), [final counts](l7-final-order-pixels.json), [opened final sheet](l7-final-review.png).

## Special check: L8 WebGPU repeat

Four L7→L8 gameplay captures at tick 180 (both backends/tiers) have **exact RGB and entity equality**. Original high-WebGPU handover captures at tick 120 initially differ only in the requested numbered weapon rack. With that rack present on both trees, **Group B→C L7 and L8 captures are exactly identical across all 1,440,000 pixels**. The earlier unexplained 0.28% does not reproduce in this controlled loader comparison. [Gameplay counts](l8-pixels.json), [original review](load-comparison.jpg), [controlled comparison](load-groupB-comparison.md).

After the deliberate hat-overlap correction, the same full captures differ by 14 L7 pixels and 37 L8 pixels (0.00097% / 0.00257%). Opened [final crop sheet](load-final-review.png): tiny survivor hair/hat edges; courier outfit, world, APC/lights, shadows and camera are unchanged. [Counts](load-final-comparison.md). Pixel-mode load durations are not isolated timing acceptance measurements. Prepared/fresh L8 simulation additionally matches 22 snapshots over 600 ticks per tier; both L10 arrival cases pass with unchanged pins/bands.

## Native timing

All measurements use `tools/perf/quiet-run.sh`, headless Metal, one worker, and reservations capped below twenty minutes. [Conditions](native-conditions.jsonl), [initial receipts](native-gates.json), [cache revalidation](cache-revalidation.json).

Pre-Group-C L7: 4/6 pass; low district p95 **33.8 > 33.3 ms**, low rocket max **51.8 > 50 ms**. Initial merged selection: 15/18 pass; the same L7 cases remain red (**33.5 ms / 62.6 ms**). High district hitch improves **27.8→18.8 ms**; low district simulation p95 **4.6→4.2 ms**. All limits unchanged.

Initial campaign matrix: 11/12 pass; L5 WebGL high is **100.1 > 100 ms**, with 52 roof/window node builds. Pre-Group-C isolated L5 passes at **83.4 ms, eight builds**. Level-load alone reproduces 52 builds (83.2 ms, passing that measurement), placing the rebuild regression before l7-perf. The corrected final matrix passes **17/18**, including **all 12 campaign cases**: L5 high returns to eight builds and 83.4 ms in both backends. Low district now passes at p95 33.3 ms; the remaining low rocket maximum is **51.0 > 50 ms**, also red before Group C (51.8 ms). High district p95 is 11.8 ms, max 26.2 ms, heap 106.45 MB; low district simulation p95 is 4.2 ms. The combined native reservation completed in approximately seven minutes. [Final native metric files](evidence/native-fixed-l7/), [complete native log](evidence/native-fixed.log.gz).

## Remaining reds / finalization

Pending: final functional refresh, final source/base check and final L8 capture after cache correction. The sole owned temporary baseline worktree has been removed. Known pre-existing E03 landscape HUD coverage is 27.26% against 27%; the broad E03 gate was not rerun here. Existing E29 failures and the native baseline failures above are retained explicitly.
