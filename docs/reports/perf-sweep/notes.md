# E18 campaign performance sweep

Baseline revision: `b3d7492f`. A fresh `npm run build` is served by Vite preview on port 3483; Scene Lab port 3484 is reserved. Hardware: Apple M4, 16 GiB RAM, Chrome 155.0.8059.40 (Metal). Native Chrome is always headless, one worker, ANGLE Metal, uncapped cadence, viewport 1600×900 and DPR 1 on both quality tiers. Every timing invocation goes directly through `tools/perf/quiet-run.sh`, with admission conditions saved alongside the data.

## Method

Load each real level with seed 2 and its default progression. Begin its mission where available (L7 uses a departure controller), enable god mode, and sample the opening position plus every registered district photo target; L10 also includes authored checkpoint targets. Use instant normal game framing, await asset/shader readiness, warm for two seconds, collect garbage, then sample five seconds of real-clock gameplay. Optional full-skeleton Scene Lab recording is disabled. Read actual `perf().backend` to reject fallback. The per-cell table takes the maximum of each spot percentile and counter, rather than pooling easier spots with difficult ones. Sim p95 uses nonzero `simTickMs` (single tick), while raw hitches include frame sim/update/render costs. Retained JS heap uses CDP `Runtime.getHeapUsage.usedSize` after garbage collection, in decimal MB.

The test API uses its standard test-mode UI; this is a fixed-camera campaign sweep, not a full bot playthrough, CPU-throttled phone certification, or a cold-start/whole-route streaming benchmark. Camera target teleports occur outside the measurement window. Existing stress/transition probes provide complementary coverage. No preset, population cap, effect, or draw-distance budget is changed.

## Limits

High/low: frame p95 ≤16.7/33.3 ms; sim p95 ≤4/6 ms; draws ≤600/300; triangles ≤1,500,000/500,000; heap ≤400/250 MB. Gameplay hitch ceiling: 50 ms. Sources: `specs/epic-18-performance-quality-mobile.md`, `specs/91-test-plan.md`, and the existing per-level perf specifications. `docs/qa/deploy-gate.md` also requires the usual static, unit, build and touched-area checks.

## Reproduction

```sh
npm run build
E2E_PORT=3483 SCENE_PORT=3484 SWEEP_PHASE=after PERF_CONDITIONS_LOG=docs/reports/perf-sweep/after-conditions.jsonl sh tools/perf/quiet-run.sh npx playwright test tests/perf/campaign-sweep.spec.ts --project=chromium --workers=1
npx tsx tools/perf/campaign-summary.ts after
```

The default `after` phase asserts all budgets. To profile a measured offender, set `SWEEP_PROFILE=L<n>-<tier>-<backend>` and optionally `SWEEP_SPOT=<registered spot id>`, with a separate output phase and matching Playwright `--grep`; CPU profiles are saved next to the spot samples.

## T-E07-11

Hetzner baseline: 2.466385 ms p95 against 4 ms (38.3% margin). Confirmation after render changes: **2.154755 ms p95, 46.1% margin**, exceeding the requested 15% margin. [Baseline](T-E07-11-before.json), [confirmation](T-E07-11-confirmation.json). Mega-200 simulation work is outside this lane.

## Fixes and validation

Implemented three render fixes after CPU/pipeline profiling:

1. `GroundField.height`: precomputed barycentric terms plus highest-face-first buckets, with conservative slope bounds and bucket invalidation on mesh additions. Clean L2 CPU sampling attributed 413 ms of a five-second window to repeated ground queries, mainly vehicle tyre contacts. The geometry and edge tolerance are preserved; horizontal faces return their constant height. Ray-cast comparison tests cover overlapping planes and slopes. Sampled ground-query CPU fell from 0.530 to 0.260 ms/frame (about 51%) in the matched diagnostic windows.
2. `PaletteMaterial.customProgramCacheKey`: reuse the numeric scratch array and cache property-name hashes, while enumerating current properties and reading every current node key. Clean L2 sampling identified the original key construction as a render-side hot path. Five 100,000-call Hetzner rounds measured a 7.6% median CPU reduction. Reference-equivalence tests cover weather changes, direct node replacement, newly added nodes and frozen copies; no node-graph key is memoized across changes.
3. Corgi prewarming: render a temporary clone of the actual rigid prototype in front of the loading camera, including the daylight graph after the temporary fire pulse is removed. Clean L4 recorded a 4.9 ms pipeline creation for `npc:pal_corgiOrange:2` at tick 140 and a 35.9 ms hitch. The temporary render object is removed before gameplay; companion simulation and assets are unchanged. After prewarming, pipeline creation disappeared from the arrival window and its hitch fell to 16.3 ms (about 55%).

The initial 40-cell pass included `debug=true`, which enabled Rapier wireframe drawing. It passed all sampled budgets but is retained only as diagnostic evidence; it is not used to claim speedups. The final matrix and `clean-profiles`/`ordered-profile`/`revised-profiles` omit that flag. The original full-skeleton probe attempt is excluded.

The L9 streaming tool now accepts either backend, rejects fallback, records p50/p99 in addition to p95, and can run route timing separately from its memory-lap audit. [All 12 baseline route/tier/backend cases](stream-summary.json) passed, with full crowd caps and streaming/crash work inside the measurement window. Retained heap is budgeted; larger transient `performance.memory` peaks are also retained in the raw evidence.

The L7 stress fixture's old spawn list now filters collision-invalid points and fills legal points inside the same plaza footprint; its expected persistent-fire count follows the authored city plus corridor fire lists. Its caps, camera, rocket cadence, effects and timing budgets are preserved.

Validation: typecheck/lint and seven focused cache/weather tests passed on Hetzner. Full unit run: 1,379 passed, two asset-derived checks failed (seven skipped). Both failures reproduce with the original render sources: [full unit summary](unit-summary.json), [baseline confirmation](baseline-unit-summary.json). They concern physics metadata and the `kit.dispersal-turbine-hall` static-collision cache, which this lane does not modify. Render fixes are committed as `6cbf89b7`; the final clean matrix records 40 cells and 324 sample windows. All resource and p95 budgets pass; L5 high/low WebGL alone exceed the 50 ms hitch ceiling (74.5/72.8 ms), pending a diagnostic trace and repeat measurement. Supplemental native checks are still running.

An independent runner-GC variable collision blocked remote validation by failing to remove stale caches. Commit `ec37a867` fixes it; its retention/removal regression test passed on Hetzner.

The full E18 verifier on Hetzner passed its static checks, build and 319 Node tests. Its browser stages failed to bind the default port (3301), so the browser checks were restarted with the reserved 3483/3484 ports. The original attempt is archived in [verify-attempt](verify-attempt/checks.json); native GPU timing is measured on the Mac, separately from remote functional checks.

## L9 full-route supplemental measurements

These fresh-build baseline measurements include streaming, full 200/100 crowd caps and crash work, rather than only stationary campaign cameras. Times are ms; retained heap is MB.

| Route | Tier | Backend | p50 | p95 | p99 | Hitch | Sim p95 | Draws | Triangles | Heap MB |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| road | low | webgl | 3.20 | 6.50 | 8.10 | 15.20 | 0.90 | 98 | 302689 | 122.23 |
| countryside | low | webgl | 3.50 | 6.60 | 8.30 | 13.50 | 0.90 | 98 | 378450 | 112.91 |
| dry-shortcut | low | webgl | 2.90 | 7.30 | 8.80 | 15.10 | 0.90 | 98 | 301511 | 113.84 |
| road | high | webgl | 5.10 | 11.10 | 13.00 | 35.40 | 1.10 | 116 | 1086519 | 161.62 |
| countryside | high | webgl | 5.60 | 12.20 | 14.20 | 37.70 | 1.10 | 120 | 1033149 | 166.99 |
| dry-shortcut | high | webgl | 5.70 | 11.90 | 13.50 | 35.60 | 1.10 | 118 | 1086519 | 165.96 |
| road | high | webgpu | 5.30 | 11.40 | 13.40 | 36.10 | 1.00 | 116 | 1086519 | 157.06 |
| countryside | high | webgpu | 5.70 | 12.60 | 14.50 | 36.60 | 1.00 | 122 | 1034707 | 162.45 |
| dry-shortcut | high | webgpu | 5.80 | 12.30 | 13.90 | 25.00 | 1.00 | 116 | 1087477 | 161.36 |
| road | low | webgpu | 1.60 | 5.10 | 6.40 | 14.90 | 0.60 | 98 | 302659 | 119.58 |
| countryside | low | webgpu | 2.10 | 5.70 | 6.70 | 13.40 | 0.60 | 98 | 392608 | 110.41 |
| dry-shortcut | low | webgpu | 1.90 | 5.90 | 6.90 | 14.00 | 0.60 | 98 | 301659 | 111.32 |

Remote functional follow-up: **25 passed / 11 failed**. Nine failures report WebGPU buffer/device errors on the Hetzner adapter (`createBuffer` rejects even a 48-byte mapped buffer, or `Instance dropped in popErrorScope`); the other two are a controls timeout and the automatic-quality assertion. These are recorded in [functional-summary.json](functional-summary.json). The Mac sweep exercises the actual native WebGPU backend; the controls/quality checks are also queued on the Mac to distinguish remote execution failures. This is not a green deploy gate.

Native functional follow-up: **5 passed / 1 failed**: controls, context restoration, visibility, title settings and perf overlay passed; automatic quality still reports high after the six-second poll. [Native results](native-functional-results.json). Corgi Scene Lab: **12/12 passed** across both tiers, three zooms and both backends. Close/wide sheets were visually reviewed for colour, foot support, facing and clipping: [WebGL](corgi-webgl/index.md), [WebGPU](corgi-webgpu/index.md).

## Additional L7 stress diagnostics (pending closure)

The corrected full-cap rocket/fire probe passed high on both backends (11.0/10.6 ms p95), and low WebGPU passed at 33.0 ms with 4× CPU throttle. Low WebGL measured 34.5 ms, then 34.2 ms on an instrumented repeat, against its unchanged 33.3 ms limit. The instrumented repeat attributes 7.0 ms p95 to NPC view updates and records a 168.4 ms hitch alongside seven new node builds. These are additional phone/stress findings beyond the desktop campaign matrix. Raw results: [stress](l7-stress-after/district-perf-low.json), [phase profile](l7-stress-profile/district-perf-low.json). CPU profiling is queued before any further game change.

To capture Chrome tracing as well as a CPU profile, use `SWEEP_TRACE=1` and optionally `SWEEP_TRACE_SPOT=<id>`; trace files are gzip-compressed JSON (decompress before importing into Chrome). Reproducing L5 must retain the earlier camera visits: the isolated harbour camera has different mission state and does not reproduce the gaps. The complete profiled sequence reproduced a 59 ms gap at Kessler Lane, despite approximately 5 ms of recorded game work. [Sequence samples](l5-sequence-profile/L5-high-webgl.json). A Kessler browser trace is queued.
