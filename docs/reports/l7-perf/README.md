# L7 frame budgets — E29-AC19/20

Work in progress. AC19 resource and sim caps pass. AC20 remains open: low steady frame p95 and repeatable rocket maxima are not certified; full handover repair is being remeasured. Five-load lifecycle passes all four tier/backend combinations before the handover preparation change.

Base: `33181db1a` (merge of the requested `lane/heap-budgets` and `lane/hitches2`). The preserved production baseline is served independently from `/tmp/l7-perf-baseline-dist`; the candidate uses this worktree's production build. No spec, test, threshold, population, corpse lifetime, particle count, quality setting, LOD policy or draw distance is changed.

## Contract and starting evidence

E29-AC19: high/low draws ≤600/300, triangles ≤1.5M/500k, sim p95 ≤4/6 ms, infected ≤200/100, collected JS heap ≤400/250 decimal MB, and the existing E18 effect/light/prop caps. E29-AC20: warmed desktop/phone frame p95 ≤16.7/33.3 ms, desktop blasts/transitions ≤50 ms, retained resources ≤110% of initial load with accessibility settings preserved. The unchanged fixtures also apply the 50 ms maximum to their phone runs.

The prerequisite heap lane's measured first candidate had low district/horde p95 33.8/33.8 ms and a low rocket maximum of 52.8 ms; collected heaps and sim p95 passed. Its later refinements had not been remeasured. Those historical figures are not a fresh baseline for this merged source. Two initial original-build timing attempts exited 75 at the unchanged 30-minute admission limit, before measurement. A later complete original-build matrix succeeded in collecting all 12 cases; its failures and passes are in [native-before.json](evidence/native-before.json).

## Profile and implementation

Fresh headless Metal diagnostics use `loadProfile=2`, renderer.info, the existing CPU split, CDP sampling restricted to the combat window, and separate paused GPU timestamp draws. These instrumented frame times are not acceptance results. Low WebGL horde CPU view p95 was 15.6 ms (render submission 7.6 ms, NPCs 3.8 ms, infected crowd 1.4 ms); sampled GPU draws were approximately 3.3 ms. WebGPU horde CPU view p95 was 16.5 ms and separate GPU draws approximately 6.3 ms. Both had zero new node builds in the measured combat window. Rocket refill batches consumed up to 32.1 ms in the WebGL diagnostic; admission's bounded occupancy searches dominate this burst. See [profile summary](evidence/profile-before-summary.json).

The first candidate removes repeated work while retaining the same calculations:

- Health bars reuse each submitted body's exact world part matrices between their world and projected bound queries. Projection still transforms every original part box in the original order. A new submission invalidates the cache; level reset releases it.
- Pose interpolation computes frame bounds once per part matrix. Integer pose layers copy their existing float32 row directly, including a no-copy path when correcting that same row.
- Paw sole minima omit the homogeneous division only when its divisor is exactly one; the general matrix path remains.
- Infected spawning counts the same 30 m live neighborhood directly into seven reused counters and uses the existing deterministic tie-break helper. This removes temporary filtered/mapped crowds from rocket refill bursts.

Candidate 2 adds an exact blocking-body witness to adjacent admission probes (clear probes still run the full query) and places immutable rig-part indices in a static uniform group. Candidate 3 computes only the projected Y/W coordinates consumed by health bars and uploads only the active prefixes of existing bar, shadow and light buffers. Capacities and draw counts stay unchanged. Projected-top arithmetic matches 1,000 baseline poses/cameras exactly; admission equivalence covers 518 spawns, 1,120 finds, 14 full snapshots and 418 persistent corpses.

No shader effect, lighting source list, shadow policy or effect appearance changes. The profile did not identify cold blast shaders as the remaining cause.

## Visual and numeric equivalence

This section records the first candidate. Candidate 2 repeats also produce 18/24 exact pairs, including all 12 actual L7 horde frames. The six high synthetic rocket frames differ at 1–29 pixels. Candidate 3 captures are pending.

All 24 final fixed-tick entity/health/transform/corpse censuses match the baseline. All 12 actual L7 horde frame pairs are exactly RGB-identical across high/low and WebGL/WebGPU. Across all 24 horde/rocket pairs, 18 are exactly identical; the six differing synthetic high-tier rocket frames differ at 3–17 pixels, with maximum channel delta 28. Every RGB difference is counted without masking, alignment or tolerance. Earlier captures and unchanged-build controls also exhibit variation; exact equality is not claimed for every synthetic rocket frame. [Raw final pixel counts](evidence/pixels.json), [unchanged baseline repeat](evidence/baseline-repeat-pixels.json).

Independent numeric comparisons against the merged baseline match 57,600 pose components across 400 samples/three layers, all 9,600 bound coordinates in 1,600 world/projected queries, and 518,400 corgi world-matrix components across 600 turning/gait-change frames. [Pose/bounds equality](evidence/pose-bounds-equivalence.json), [corgi equality](evidence/cpu-equivalence.json).

Comparison sheets: [WebGL high](evidence/horde-webgl2-high.jpg), [WebGL low](evidence/horde-webgl2-low.jpg), [WebGPU high](evidence/horde-webgpu-high.jpg), [WebGPU low](evidence/horde-webgpu-low.jpg). Full-resolution source frames remain local under `test-results/l7-perf/`.

## Reproduction and evidence ownership

All browser work is headless, one live browser at a time, on ports 3971/3972 through `sh tools/e2e-lock.sh`. Timing runs additionally own `tools/perf/quiet-run.sh`; each reservation is capped at 20 minutes and each admission at 30 minutes. Pixel-only captures use the normal browser lock and make no timing claims. CPU-heavy unit/level work runs remotely with four workers.

The existing district/encounter fixtures select either backend. The stock rocket fixture forces WebGL; `tools/perf/l7-rocket-backend.ts` adds WebGPU with an identical evaluation body, warmup/window/refill behavior and heap helper. The body hash and unchanged test receipt are in [measurement-receipt.json](evidence/measurement-receipt.json). The existing transition audit only gains backend selection and actual adapter identification; its window, transitions, setup and limits remain unchanged.

Raw CPU profiles, complete frame records and individual captures stay in ignored local `test-results/l7-perf/`. Committed JSON is limited to compact summaries and receipts. No deployment, push or merge into main is performed.

## Validation

The merged baseline full remote unit/level suite passes **2,155 tests / 394 files**, with 11 tests / 3 files skipped; [receipt](evidence/unit-before.json). The first candidate passes the selected E29/smoke simulation stage (**112 tests**) of full verify; its browser stage is held behind the budget work. Its complete remote unit/level run passes 2,157 tests, with 9 skipped (same total 2,166 tests; two existing audio checks run on this runner).

The first candidate's native matrix fails low district/horde frame and rocket maximum gates. These are candidate figures, not a newly measured original baseline: [all first-candidate numbers](evidence/attempt1-budgets.json). The isolated original-baseline attempt again timed out before admission. No complete native matrix pass is claimed. Candidate 2's targeted admission/render tests pass remotely. Its native rocket maxima pass high/low: WebGL 24.9/43.7 ms, WebGPU 22.9/46.3 ms. Low district/horde p95 remains 33.7/33.8 ms WebGL and 33.9/34.6 ms WebGPU. Every measured sim, draw, triangle, population and collected-heap cap passes. [Candidate 2 matrix](evidence/attempt2-budgets.json).

Candidate 3's first high WebGL transition sweep measures checkpoint 37.2 ms but boarding/handover 2,739.6 ms during L8 loading. This is a failure; it is not excluded from the transition window. E29-AC19/20 remain open pending the final matrix, lifecycle and loading repair.

## Fresh before/after measurements (milliseconds)

The original-build “before” rows use preserved production build `33181db1a`. “Candidate 3” includes the render/admission changes, before handover loading repair. These are whole-run observations, including failures; individual passing attempts are not substituted for failing repeats. The final candidate has a separate receipt and will replace this provisional comparison when its run finishes.

| Backend / case / tier | Frame p95, before → candidate 3 | Maximum, before → candidate 3 | Sim p95, before → candidate 3 |
| --- | ---: | ---: | ---: |
| webgpu / district / high | 12.1 → 12.0 | 17.9 → 17.9 | 1.8 → 1.8 |
| webgl / district / high | 12.2 → 12.0 | 27.5 → 30.7 | 2.1 → 2.1 |
| webgpu / district / low | 33.0 → 34.1 | 37.2 → 43.5 | 4.3 → 4.5 |
| webgl / district / low | 34.0 → 33.7 | 37.3 → 36.3 | 4.5 → 4.5 |
| webgpu / encounters / high | 10.8 → 10.8 | 24.8 → 24.0 | 1.8 → 1.9 |
| webgl / encounters / high | 11.4 → 10.8 | 25.7 → 25.7 | 2.1 → 2.1 |
| webgpu / encounters / low | 33.1 → 34.8 | 35.9 → 37.3 | 4.6 → 4.3 |
| webgl / encounters / low | 33.7 → 33.4 | 47.9 → 49.2 | 5.0 → 4.5 |
| webgpu / rocket / high | 6.8 → 6.8 | 20.8 → 22.8 | 1.3 → 1.2 |
| webgl / rocket / high | 8.2 → 7.8 | 24.6 → 25.3 | 1.4 → 1.3 |
| webgpu / rocket / low | 17.9 → 18.1 | 62.4 → 59.6 | 2.3 → 2.2 |
| webgl / rocket / low | 31.9 → 20.4 | 65.8 → 49.0 | 2.5 → 2.5 |

AC19 across that matrix: maximum high/low draws **231/165 → 231/165**, triangles **965,941/405,447 → 963,618/393,437**, sim p95 **2.1/5.0 → 2.1/4.5 ms**, collected heap **97.38/86.15 → 97.51/86.30 MB**, infected **200/100 → 200/100**. All literal caps pass. Different real-time frame cadences can change the observed peak triangles/effect ages; populations and geometry settings are unchanged.

AC20 lifecycle, candidate 3: after five L7→L1→L7→L1→L7 loads, retained heap is **95.1–95.7%** of the first load; geometries decrease and textures rise by one (at most 1.8%). Flash reduction, shake and gore settings are preserved in all four cases. [Lifecycle readings](evidence/lifecycle-attempt3.json). The original-build and final-candidate repeat are pending.

## Handover repair iterations

The complete handover window includes the loading card and ends only at a fully loaded L8. Before the loading repair, high WebGL/WebGPU maxima were **2,739.6/2,591.8 ms**. Cooperative node builds, paced asset parsing and smaller warmup groups reduce these to **128.3/110.4 ms**, still failures. [Before](evidence/transitions-before.json), [cooperative iteration](evidence/transitions-attempt4.json).

The latest committed iteration prepares L8's default immutable layout/navigation behind L7's initial card, consumes it once, separates teardown/world/mission work with presented frames, and preserves the prior image while loading. Canvas submissions are capped at 60 per second. An initial uncapped presentation attempt saturated the GPU and was interrupted; it is not counted as completed coverage. The revised iteration is queued for measurement.

Prepared versus fresh L8 construction matches complete sim/entity snapshots at 60-tick intervals over 600 ticks on each tier (**22 snapshots**). [Equivalence receipt](evidence/handover-equivalence.json). The eight-contact admission cache retains the same **518 spawn / 1,120 search / 14 snapshot / 418 corpse** equivalence proof. [Admission receipt](evidence/admission-equivalence.json).
