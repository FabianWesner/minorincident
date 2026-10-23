# Shared browser pool — 2026-10-23

Recommend **four shared GPU contexts**, one GPU Chrome root, at most two SwiftShader contexts, and one exclusive timing context. At four clients the measured queue-inclusive Scene Lab throughput rose from **6.66 to 21.89 scenes/min (3.28×)**. The four-lane job load finished in **3.29 s versus 52.79 s**, with mean browser admission wait **0.69 s versus 30.03 s**. These comparisons use the one-GPU safety-constrained baseline described below.

Implementation and migration: commits `bc167a02c`, `f7f4b65d6` and `9a8e347d1` on `lane/browser-pool`, based on `986a168a7`. [Operation, compatibility, timeouts and flags](../../../tools/browser-pool/README.md). Raw measurements and decoded capture hashes: [measurements.json](measurements.json). Check receipts: [verification.json](verification.json).

## Method and scope

Same production build and unchanged authored fixtures: `bench-sitter` (300 ticks/two PNGs), `house` (30/two), `courier-turns` (540/four), `qa-grove-east-south` (26/three). Every client runs all four; high quality, WebGL2/Metal, 1280×720, DPR 1, authored seeds, gates and readiness waits. One private preview on port 4321 serves the identical build. Foundation smoke measurements run both tests in `tests/e2e/smoke.spec.ts`, one Playwright worker per client; the full smoke gate is checked separately.

The before path retains browser-per-script reuse and whole-script process locks. This job explicitly forbids a second GPU Chrome, so the baseline reserves all legacy slots and serializes Chrome even with 2/4/6 queued clients. It measures that safe baseline, **not a new run of the former two-GPU-process policy**. Historical multi-process numbers remain in [render-test-parallel](../render-test-parallel.md); they use a different revision/method and are not a controlled current comparison. The after path uses the same headless-shell binary, a fresh isolated context per spec/test, four-context admission and one GPU process. Six clients queue behind that cap; six simultaneous contexts were not tested.

Wall times include command startup, admission and the ten-second GPU guard. Scene throughput is completed authored scenes/group wall time. The first pooled client includes cold daemon/browser startup; later groups use a primed process. The pooled sweep was resumed between completed batches; each group retains its own stopwatch and samples. Background host load is retained. These are short capacity runs on a machine in use, not a soak test or an isolated CPU throughput experiment.

## Throughput and smoke

| Clients | Before scenes/min | Pool scenes/min | Speedup | Before foundation smoke (s) | Pool foundation smoke (s) |
| --- | --- | --- | --- | --- | --- |
| 1 | 6.06 | 5.92 | 0.98× | 12.33 | 2.35 |
| 2 | 6.69 | 14.81 | 2.21× | 25.57 | 3.00 |
| 4 | 6.66 | 21.89 | 3.28× | 49.63 | 3.79 |
| 6 | 6.68 | 21.85 | 3.27× | 75.56 | 5.07 |

All **52 scenes and 26 foundation smoke tests per path pass**. A cold single client costs 40.54 s pooled versus 39.63 s before; the benefit comes from sharing admission/startup across queued work. Foundation smoke is a small fixed workload; its speedup is not a measurement of the full campaign battery.

## WindowServer, Chrome memory and stability

Chrome RSS is a sampled sum of the owned root and descendants, including shared mappings; it is not private/physical footprint. WindowServer CPU is CPU-time delta/elapsed time; the peak is the maximum roughly one-second sample. Peaks between samples may be missed.

| Clients | Before Chrome peak (GiB) | Pool Chrome peak (GiB) | Before WindowServer mean / peak (%) | Pool mean / peak (%) |
| --- | --- | --- | --- | --- |
| 1 | 2.60 | 1.85 | 1.82 / 3.05 | 0.86 / 2.05 |
| 2 | 2.49 | 3.41 | 4.24 / 7.82 | 1.48 / 2.09 |
| 4 | 2.65 | 5.00 | 1.46 / 8.15 | 2.14 / 6.39 |
| 6 | 2.66 | 4.90 | 1.02 / 4.00 | 2.20 / 4.04 |

Every group observed **at most one GPU Chrome root**. WindowServer remained PID **27597** throughout both sweeps: **zero observed kills/restarts**. All 104 scene executions completed without console failures or unexpected outcomes. These observations cover this fixed set, not every mission or future crash rate. The daemon samples WindowServer over ten seconds and reduces admission above 60%; it recovers one context after three consecutive samples below 30%, and falls to one on missing/invalid samples.

## Correctness

**143/143 pooled captures have exactly zero changed decoded RGBA pixels** against the serial old-path reference; all 143 repeated before captures also match that reference. Backend, viewport, quality, authored frame count and gates are preserved. Representative identical pair: [old Grove frame 0](grove-before.png), [pooled Grove frame 0](grove-after.png).

Initial validation exposed job-local zoom being lost when a multi-spec Scene Lab job changed leases. That value also affects fog/DOF at photo camera poses. The runner now carries its presentation zoom between its own contexts, keeping other clients isolated; the full pooled capture sweep was repeated after the correction. No scene criteria, simulation ticks or screenshot comparisons were relaxed.

## Four-lane waiting

Actual headless load: four clients, each doing two twelve-frame canvas steps separated by two seconds of simulated remote judging. The old lock/browser survives the idle interval; the pool closes the step's context. Startup/guard are included in admission waits.

| Path | Wall (s) | Mean first admission wait (s) | Max first admission wait (s) |
| --- | --- | --- | --- |
| Before, one-GPU safety baseline | 52.78 | 30.03 | 49.81 |
| Pool, four contexts/one GPU Chrome | 3.29 | 0.69 | 0.69 |

A separate deterministic [two-slot scheduling model](four-lane-model.json) isolates idle release from browser startup: four lanes, two 200 ms steps, 2 s remote judging. Whole-script two-slot admission gives 4.8 s wall and 1.2 s mean queue wait; per-step admission with the same two contexts gives 2.6 s/0.1 s. Four pooled contexts give 2.4 s/zero queue wait. This row is a scheduling model, not a measurement of two simultaneous GPU browsers.

## Exclusive timing

Same authored house scene, WebGL2 high, native Chrome, uncapped cadence, 180 warm-up RAFs then three 900-frame samples per path. Both commands used quiet-run; condition samples and full frame distributions are in [timing.json](timing.json).

| Path | Round medians (ms) | Round p95 (ms) | Combined p50 / p95 (ms) |
| --- | --- | --- | --- |
| Old quiet-run | 2.800, 2.800, 2.800 | 5.500, 5.400, 5.500 | 2.800 / 5.500 |
| Pool exclusive | 2.800, 2.800, 2.800 | 5.400, 5.400, 5.500 | 2.800 / 5.400 |

The median is **2.800 ms on both paths in every round**. Aggregate p95 is **5.500 ms before versus 5.400 ms pooled** (−0.100 ms, −1.8%); individual rounds span 5.4–5.5 ms on both paths. The difference is within that observed round-to-round spread, with no measured median regression. Admission and all host samples stayed below load 3, with no foreign browser/Vitest/Blender/build observed. This short single-scene check supports timing equivalence for the native exclusive path; it does not establish a universal performance bound.

## Verification and limits

Remote unit suite: **2018 passed, 7 skipped, zero failures**, maximum four workers. Real lifecycle checks pass: storage isolation, two-context SwiftShader queuing, safe context disposal, in-flight action handling, context/browser idle release, exclusive drain, native reconfiguration/reconnect, opaque exclusive commands, portable profile state, and **pool down → legacy headless launch/actions/capture**. The `ws` and `@types/ws` dependencies are MIT and included in generated credits/notices.

Full pooled Chromium/device smoke: **28 passed, 0 failed, 0 skipped** (138.35 s). Caller receipts are in [verification.json](verification.json): Scene Lab catalog and MCP, the Mac WebGPU invariant path, playtest session/profile saving, live action/capture plus idle release, and local same-build QA A/B all passed. The A/B park stop at zoom 1 and 1.5 had zero changed coverage. Browser tests remain headless with at most two Playwright workers per command.

Use **N=4 shared GPU contexts** for functional/capture jobs. N=4 delivered 48% more throughput than N=2 at about 5.0 GiB summed Chrome RSS; N=6 clients behind the same cap gave no further throughput. Keep six-context admission disabled by default because it was not measured. SwiftShader stays at two contexts for CPU protection. Timing always uses exclusive quiet-run. Reduce the shared cap for large mission batteries or low memory headroom; this small-fixture evidence does not establish their capacity. The daemon's per-step/idle release and adaptive guard remain enabled.

For `CLAUDE.local.md`: “Use the shared headless browser pool when available: one GPU Chrome, N=4 shared functional contexts (SwiftShader max 2); each Playwright command still uses at most 2 workers. Release per spec/capture step, idle context/browser timeout 60 s. Native timing uses exclusive quiet-run, load < 3 and no local Vitest/Blender/build. Pool down falls back to legacy guarded launch. Four is a measured small-fixture limit, not a promise for four large missions.”
