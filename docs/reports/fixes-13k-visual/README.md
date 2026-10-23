# Q-124/125/126/127/129 — implementation checkpoint

Base `bfff62015` (batch 13j). Work is not yet accepted: the near-band p95 gate and final validation remain outstanding. No deployment or merge.

## Changes and red-first evidence

- **Q-124:** shipped prone Alpha boots exceeded 1 m above ground. A two-bone lower-leg solve preserves segment lengths and levels the soles; the Mega uses its authored side fall. Tests cover all eight delivered Alpha/Mega looks. The 65 cm absolute boot-top assertion applies to prone Alphas; the side-lying Mega checks level soles and boot thickness because its upper hip rests above the lower hip. The delivered Alpha test failed before correction.
- **Near corpses:** regular infected use frozen LOD1 pages inside 8 m, retaining them until 10 m on retreat. Spatial queries inspect nearby bodies only. Page switches retain identity, pose, tint, overlays, appearance, population and animated membership revision. The approach/retreat test failed against the old LOD2-only pool. Four backend/tier runtime cases retain one body through LOD 2/1/1/2/1.
- **Q-125:** infected bars require positive HP, including recoverable downed Alphas. The old zero-HP/recovery case failed before the fix. Real shotgun damage removes the bar at the first zero-HP frame (53), through frame 240, on both backends and tiers. Living bars are also asserted present.
- **Q-126:** quiet cold profiles cross the reported L1 delivery street with physical keys and start L2 boarding/ride with physical E. Baseline original 266/450 ms stalls did not reproduce. Profiles exposed first-use seated geometry/node programs around L2 ticks 282–284: `prewarmOccupants` selected only `transport` vehicles, but the fire engine has no such field. It now selects the mission truck ID and retains the actual warmed courier/crew rigs. The regression test failed first on disposable negative-ID prototypes, then on the real non-transport fire-engine definition. A trial escort warm-up did not remove L1's later head programs and was removed. Final profiles after the truck selection correction are pending.
- **Q-127:** distance fog reached the cool background before the warm ground-height haze, exposing rectangular boundaries. During departure, the backdrop receives the same haze and fully fogged surfaces converge to that exact backdrop color after height haze. The graph is prepared during loading; camera/map bounds are unchanged. Baseline captures reproduce the cutoff; the final 48 frames were reviewed and have continuous coverage along the top edge.
- **Q-129:** wedge top 5.68 m was below deck top 5.70 m. Wedge top is now 5.71 m. The authored-height assertion failed before correction. D-CORRIDOR base GLB and layout metadata were rebuilt. Both backend matrices show continuous concrete across the former seam.

## Capture review

[Matrix WebGL2](captures/matrix/webgl2/index.md) / [matrix WebGPU](captures/matrix/webgpu/index.md): 36/36 combinations, Alpha/Mega/L3 × high/low × zoom 0.5/1/1.5, with four sampled frames each. All sheets inspected: low, flat Alpha boots; recognizable Mega side profile with separate head/arms/legs; continuous L3 deck junction, without flicker. A new matrix after packed-buffer changes is pending.

[L7 baseline](captures/l7-before/evidence.json) / [L7 final](captures/l7-final/evidence.json): both tiers and all three pre-shot zooms, candidate on both backends, frames 0/120/300/450. All twelve final sheets inspected. Zoom 0.5 starts close to the courier cab, zoom 1 shows the bus/street, zoom 1.5 shows the wider street. Every pull-back ends under continuous warm fog, with city silhouettes retained and no rectangular void. The cinematic blocks zoom changes while running, so each case sets zoom before departure and asserts it remains active. An earlier nominal-zoom matrix was rejected because input during the shot left all cases at zoom 1.

[Corpse runtime](captures/corpse-runtime/evidence.json) records the retained body and exact HP-bar lifecycle for four backend/tier cases.

## Performance — acceptance still pending

Identical L10 low permanent fields: **282 corpses**, including all seven regular infected looks; no population/count reductions. Quiet native uncapped Chrome, 1280×720, zoom 1, three six-second samples per backend.

| Attempt | WebGL2 median p95 | WebGPU median p95 | Result |
|---|---:|---:|---|
| Baseline batch 13j | 3.2 ms | 2.2–2.3 ms | reference |
| Initial near band | 3.9 ms | 2.6 ms | rejected |
| Per-instance palette constants | 3.8 ms | 2.7 ms | rejected; removed |
| Packed frozen normals/colors | pending | pending | not accepted yet |

Dense-field CPU profiles attribute the added time to GPU backpressure in `drawElementsInstanced`, not palette selection. Frozen GPU buffers now use normalized 16-bit normals/colors, while CPU pose geometry, positions, index buffers, part ownership, triangle and instance counts remain exact. New tests failed before packing and bound component errors to 1/32767 for normals and 1/65535 for linear colors. HDR colors keep float storage. Final timing and visual checks are pending.

## Validation status

Typecheck, lint and 29 focused tests pass at this checkpoint. Remote unit/level suites are still running. Invariants, PROD L1–L4 A/B, smoke, final timing, profile attribution and completion audit remain outstanding.

## Later checkpoint

Q-126 corrected truck selection is verified in three cold quiet runs: L1 maxima 16.8/16.8/16.8 ms; L2 33.4/33.4/33.4 ms, down from 50/66.6/50 ms. L2 creates zero new vehicle node programs during boarding (baseline: three per run). All six paths reach the requested delivery/ride event, with no frame >200 ms. These profiles align the ride transition to ticks 282–284.

The first full remote suite ended with 2,477 passes and six stale assertions: three forbade the new LOD1 prewarm, two required Mega's old back fall, and one required the background node to be the unwrapped radial fog. Updated tests require both warm-up pages, the exact Mega side-fall, and the exact radial input with zero haze blend on L1. All 20 affected tests pass. An obsolete remote snapshot was stopped before the final resync.

Packing, the always-one live-mask removal, and index cache ordering alone did not close the p95 gap (WebGL2 3.7–3.8 ms). Packing/index-order experiments were removed. The pool is now being consolidated: regular bodies sharing a model use common pages, while selected headwear keeps its precise frozen head pose and model fit in separate shared pages. Body IDs, bodies and accessories are retained. New lifecycle/world-transform tests and fresh timing remain pending; this is not accepted performance evidence yet.

The shared-body regression test failed first (two body pages for two hats), then passed with one body page and two headwear pages. It checks exact fitted head matrices through LOD changes and throws, one probe per body, and removal without orphaned hats. Typecheck, lint and 36 focused tests pass. Fresh GPU timing is running.

## Current performance direction

Shared headwear pages and palette lookup experiments were removed: they did not close WebGL2's 0.5 ms gap and added complexity. The original fitted, combined corpse surfaces are retained. L7 haze graphs are now built only for L7; other levels retain their original radial fog graph.

Frozen pages now retain all logical instances while submitting only complete posed bounds that intersect the camera frustum. The camera-return regression failed red before culling (two instances submitted instead of one), and checks retained IDs, exact pose/tint, membership revision, removal, and insertion into an entirely offscreen page. No simulated or retained body count changes. Fresh timing and final validation remain pending.

## 08:34 checkpoint

Remote snapshot `52897d38a`: 458 files / 2,486 tests passed (3 files / 9 tests skipped), exit 0. A final source resync is still required. Per-instance culling retains all 282 logical bodies but has not met the no-regression gate: uncontaminated WebGL2 median p95 remains 3.6 ms versus baseline 3.2 ms. A general exact-input shadow-map reuse experiment is under evaluation, with conservative refresh for unknown shader effects and unit coverage of caster, light, geometry and visibility changes. It is not accepted performance evidence yet.
