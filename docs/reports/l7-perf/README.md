# L7 frame budgets — E29-AC19/20

Work in progress. Candidate 2 fixes measured rocket maxima on both backends; low district/horde frame p95 remains red. Candidate 3 is being measured. The first transition sweep exposes a separate L7→L8 loading hitch; lifecycle is not yet certified.

Base: `33181db1a` (merge of the requested `lane/heap-budgets` and `lane/hitches2`). The preserved production baseline is served independently from `/tmp/l7-perf-baseline-dist`; the candidate uses this worktree's production build. No spec, test, threshold, population, corpse lifetime, particle count, quality setting, LOD policy or draw distance is changed.

## Contract and starting evidence

E29-AC19: high/low draws ≤600/300, triangles ≤1.5M/500k, sim p95 ≤4/6 ms, infected ≤200/100, collected JS heap ≤400/250 decimal MB, and the existing E18 effect/light/prop caps. E29-AC20: warmed desktop/phone frame p95 ≤16.7/33.3 ms, desktop blasts/transitions ≤50 ms, retained resources ≤110% of initial load with accessibility settings preserved. The unchanged fixtures also apply the 50 ms maximum to their phone runs.

The prerequisite heap lane's measured first candidate had low district/horde p95 33.8/33.8 ms and a low rocket maximum of 52.8 ms; collected heaps and sim p95 passed. Its later refinements had not been remeasured. Those historical figures are not a fresh baseline for this merged source. The initial fresh native WebGL batch here exited 75 at the unchanged 30-minute admission limit, before measurement. Later attempts are recorded separately.

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

The first candidate's native matrix fails low district/horde frame and rocket maximum gates. These are candidate figures, not a newly measured original baseline: [all first-candidate numbers](evidence/attempt1-budgets.json). The isolated original-baseline attempt again timed out before admission. No native pass is claimed. Candidate 2's targeted admission/render tests pass remotely. Its native rocket maxima pass high/low: WebGL 24.9/43.7 ms, WebGPU 22.9/46.3 ms. Low district/horde p95 remains 33.7/33.8 ms WebGL and 33.9/34.6 ms WebGPU. Every measured sim, draw, triangle, population and collected-heap cap passes. [Candidate 2 matrix](evidence/attempt2-budgets.json).

Candidate 3's first high WebGL transition sweep measures checkpoint 37.2 ms but boarding/handover 2,739.6 ms during L8 loading. This is a failure; it is not excluded from the transition window. E29-AC19/20 remain open pending the final matrix, lifecycle and loading repair.
