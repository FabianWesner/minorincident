# perf9 — pre-deploy performance vs live batch 56

**Fixed-build performance verdict: FAIL.** 10/15 matrix cells pass; 5 fail; 0 incomplete. All nine named event/charge windows: 6 pass, 3 fail, 0 incomplete. Original main verdict: **FAIL** (8/15 cells pass). Every original result remains in the initial evidence; the fixed build has a fresh complete paired matrix.

Original candidate: fresh `MI_BUILD_CACHE=off npm run build` at `f849d5c3b82a4c3004a312eff308b420ea8d2de5`, bundle `index-DnjIp4Ne.js`, SHA-256 `1264a333b77b9b054bed7a49f16640c3032f35bf81013c7e9cb01466d63d5cf2`. Fixed candidate: fresh production build at `4c4cbac41026a897b9bbf67cde3270f540323d93`, bundle `index-CVWzx6_J.js`, SHA-256 `fc4312b8b1abdebcafbb1dbe2737ff4ecea4caa098b07fec5c0829cdcb5b73f7`. Control: fresh [live PROD](https://minor-incident.com/) mirror (batch 56 per the brief), bundle `index-DbFAIX8_.js`, SHA-256 `71dabceb1895250205ad7cdca0592f729930caf60867843113a29fc90b32eded`. The downloaded public bytes define the control; its live index remains unchanged at the end.

## Verdict table — fixed build

Loads are cold/warm seconds. Frame columns are milliseconds, PROD → candidate. Every WebGPU row covers a full native gameplay minute; L1 low/high and L10 high cover 90 seconds for their complete named windows.

| Scope | Cell / moment | PROD cold / warm s | Fixed cold / warm s | p95 ms P → C | Max ms P → C | Verdict |
|---|---|---:|---:|---:|---:|---|
| WebGPU | L1 low | 1.977 / 1.912 | 1.944 / 1.879 | 16.7 → 16.7 | 33.3 → 33.4 | PASS |
| WebGPU | L3 low | 2.807 / 2.728 | 3.040 / 2.944 | 16.7 → 16.7 | 16.8 → 16.8 | PASS |
| WebGPU | L4 low | 3.026 / 2.910 | 3.057 / 2.960 | 16.8 → 16.8 | 33.3 → 66.7 | FAIL: max > PROD+1 frame, new >=66 ms spike |
| WebGPU | L5 low | 2.575 / 2.478 | 2.609 / 2.561 | 16.7 → 16.8 | 33.4 → 50.0 | PASS |
| WebGPU | L7 low | 2.573 / 2.477 | 2.857 / 2.761 | 16.7 → 16.7 | 50.1 → 66.6 | FAIL: new >=66 ms spike |
| WebGPU | L10 low | 3.292 / 3.210 | 3.259 / 3.194 | 16.8 → 16.8 | 50.0 → 50.0 | PASS |
| WebGPU | L1 high | 1.863 / 1.809 | 1.844 / 1.806 | 16.8 → 16.8 | 33.4 → 50.0 | PASS |
| WebGPU | L3 high | 2.541 / 2.472 | 2.790 / 2.722 | 16.7 → 16.7 | 16.8 → 16.8 | PASS |
| WebGPU | L4 high | 3.424 / 3.374 | 3.455 / 3.305 | 16.7 → 16.8 | 50.0 → 100.0 | FAIL: max > PROD+1 frame, new >=66 ms spike |
| WebGPU | L5 high | 2.472 / 2.372 | 2.488 / 2.410 | 16.7 → 16.8 | 33.4 → 50.0 | PASS |
| WebGPU | L7 high | 2.773 / 2.706 | 3.407 / 3.338 | 16.7 → 16.7 | 50.0 → 33.4 | FAIL: cold: >PROD+0.5 s, warm: >PROD+0.5 s |
| WebGPU | L10 high | 3.008 / 2.923 | 3.023 / 2.938 | 16.7 → 16.8 | 50.1 → 66.7 | FAIL: new >=66 ms spike |
| WebGL2 load / G-01 | L1 low | 2.244 / 2.128 | 2.161 / 2.110 | — | — | PASS |
| WebGL2 load | L4 low | 3.209 / 3.123 | 3.258 / 3.139 | — | — | PASS |
| WebGL2 load | L7 low | 2.759 / 2.610 | 3.091 / 3.003 | — | — | PASS |
| Moment | L1 handover/outbreak low | — | — | 16.8 → 16.7 | 16.8 → 16.8 | PASS |
| Moment | L1 handover/outbreak high | — | — | 16.8 → 16.8 | 33.3 → 50.0 | PASS |
| Moment | L7 pickup low | — | — | 16.7 → 16.7 | 16.8 → 16.8 | PASS |
| Moment | L7 first rocket low | — | — | 16.7 → 16.8 | 16.8 → 66.6 | FAIL: max > PROD+1 frame, new >=66 ms spike |
| Moment | L7 pickup through first rocket low | — | — | 16.7 → 16.8 | 16.8 → 66.6 | FAIL: max > PROD+1 frame, new >=66 ms spike |
| Moment | L7 pickup high | — | — | 16.7 → 16.7 | 16.7 → 16.7 | PASS |
| Moment | L7 first rocket high | — | — | 16.7 → 16.7 | 16.7 → 16.8 | PASS |
| Moment | L7 pickup through first rocket high | — | — | 16.7 → 16.7 | 16.7 → 16.8 | PASS |
| Moment | L10 charge through completion (+2 s) high | — | — | 16.8 → 16.8 | 50.1 → 66.7 | FAIL: new >=66 ms spike |

## Original failures and demonstrated fix

- Original webgpu L4 low: max > PROD+1 frame, new >=66 ms spike. Cold/warm PROD 3.857 / 3.010 s → original 3.541 / 3.060 s; p95 16.8 → 16.7 ms, maximum 33.4 → 100.1 ms.
- Original webgpu L5 low: new >=66 ms spike. Cold/warm PROD 5.475 / 2.527 s → original 2.656 / 2.727 s; p95 16.8 → 16.8 ms, maximum 50.0 → 66.6 ms.
- Original webgpu L10 low: new >=66 ms spike. Cold/warm PROD 3.274 / 3.194 s → original 3.326 / 3.262 s; p95 16.7 → 16.8 ms, maximum 49.9 → 66.7 ms.
- Original webgpu L4 high: max > PROD+1 frame, new >=66 ms spike. Cold/warm PROD 3.540 / 3.323 s → original 3.489 / 3.360 s; p95 16.7 → 16.8 ms, maximum 50.0 → 100.0 ms.
- Original webgpu L5 high: max > PROD+1 frame, new >=66 ms spike. Cold/warm PROD 2.491 / 2.393 s → original 2.507 / 2.404 s; p95 16.7 → 16.7 ms, maximum 33.4 → 66.7 ms.
- Original webgpu L7 high: warm: >PROD+0.5 s. Cold/warm PROD 6.874 / 2.722 s → original 4.074 / 3.455 s; p95 16.8 → 16.8 ms, maximum 49.9 → 50.1 ms.
- Original webgpu L10 high: max > PROD+1 frame, new >=66 ms spike. Cold/warm PROD 3.059 / 2.923 s → original 3.107 / 2.941 s; p95 16.8 → 16.8 ms, maximum 50.1 → 100.0 ms.
- Original L10 charge through completion (+2 s) high: max > PROD+1 frame, new >=66 ms spike; maximum 50.1 → 100.0 ms.

The original L7 high warm load grows from 2.722 to 3.455 s (+0.733 s). Stage timings place the increase in civilian preparation and warm-up; a separate CPU-profiled pair reproduces 2.735 → 3.404 s. The profile maps the candidate’s minified `w7` to `skinnedVertexMatrix`: sampled warm-load self time is 147.8 ms, versus 22.5 ms on PROD. The additional prepared resident geometry and shader graphs protect the first pickup/rocket from first-use stalls.

Frozen-body baking redundantly blended the same weighted vertex matrix for position and normal. The first fix reuses that matrix immediately for the normal, preserving the existing transform and normalization arithmetic, attribute layouts and attribute insertion order. All models, LODs, poses, headwear, effects and warm-up coverage remain intact. No staging reduction is credited. Separate profiles reproduce the early L4/L10 stalls: their new floor searches consume 369/332 ms inclusively over the first 15 seconds, with 271/234 ms in vertex skinning. The control has no corresponding pose-repair routine.

The quiet CPU comparison covers **288 actual-asset cases, all bit identical** across position/normal/color/parts/UV arrays, indices and bounding spheres: eight civilian/infected models × three LODs × three death poses × hair variants × limb masks, with packed and GPU-padded normals. Aggregate measured bake time is 469.2 → 303.2 ms (1.55×); it alternates implementation order. This benchmark isolates the duplicated work; the table above is the separate public-build end-to-end check.

The floor-search fix computes only the vertical matrix row that is read by the search. The joint order, Float32 rounding, sampled vertices and pose-search trials remain unchanged. All 24 repaired-clip cases and 19,350 sampled full/vertical skin-matrix cases are bit identical. Measured floor-search preparation is 183.7 → 96.3 ms (1.91×).

The fixed L7 high warm load is 3.338 s versus paired PROD 2.706 s (+0.632 s). Its matrix verdict is **FAIL**. The fixed build still fails on L4 low/high frame maxima, L7 low first-rocket stalls, and L10 high charge stalls. Later captures do not erase the original failures.

The final skinning helper also uses scalar joint weights instead of allocating joint/weight scratch arrays for each sampled vertex. Its output is covered by the same full-matrix, clip and geometry comparisons; no separate incremental latency claim is made for that small allocation change.

Initial L1 low required an additional capture for coverage: the initial minute ended at the accident, before infected exit. Its complete handover/outbreak window is supplied by a separate 90-second paired capture. That window passes at 16.8 ms on both sides. The extended control’s 183.3 ms frame at +78.7 s is later than the named window; the candidate’s full extended maximum is 33.3 ms. Both full traces are retained. Initial L1 high was extended to 90 seconds before its capture; the final build measures both L1 tiers for 90 seconds.

## Validation

- `npm run typecheck`: PASS (11.3 s).
- `npm run lint`: PASS (7.9 s).
- `npm run test:unit`: PASS (25.8 s).
- `npm run verify -- E18`: PASS (45.4 s).

In this checkout, `verify -- E18` runs the current per-change gate (typecheck, lint and engine/shared tests); the retired per-AC selection is not claimed.

The fresh final production build passes public QA-hook exclusion (19 HTML/JS files). CPU fixes are committed separately by cause, followed by this report. No specs, assets, populations, settings or dependencies were changed.

## Method and limits

Apple M4 / Mac16,10 / 16 GiB / macOS 26.5.1 (25F80), Chromium 153.0.8010.12 / Playwright 1.63.0, headless native Metal WebGPU and ANGLE Metal WebGL2, 1280×720, DPR 1, seed 1. Each timing command uses `tools/perf/quiet-run.sh`, exclusive browser admission and one context at a time. Admission logs retain busy/cooldown waiting samples; every command starts after a terminal quiet admission with one-minute load below 3 and no busy processes. Owned servers use 4901 (candidate) and 4902 (mirror). Cold means a fresh isolated context and warm its reload; GPU/driver caches remain shared. Each candidate revision has one complete unprofiled paired matrix. Diagnostics and coverage extensions are retained separately.

Public menu loads use unmodified public bytes and measure the level-button click through loading-card closure. G-01 uses the L1 low WebGL2 cold measurement and confirms Begin mission is present; L7/L10 begin automatically. Native gameplay uses the same bootstrap-only Game exposure and common current-source test-control adapter on both public bundles; each keeps its own rendering, simulation and content. The complete bot supplies ordinary InputFrames; god mode prevents death during timing. L1 withholds only the final exit movement to retain its level for the measured duration. Public CPU/crowd probes are compiled out; zero readings are not used as attribution or evidence of absent actors.

L1 starts within 10 m of the lab approach, reached through native bot movement; its named window starts 100 ms before the first handover phase and ends two seconds after infected exit. L3 starts at armory, L4 at its native turn beat, L5 at its outside checkpoint, L7 before launcher pickup, and L10 at activated dispersal defense. The L7 pickup window starts 100 ms before and ends 250 ms after collection; its first-rocket window starts 100 ms before firing and ends 250 ms after the first native rocket detonation. The combined window includes pickup through that detonation. L10 charge covers the recorded charge through its first completion plus two seconds. Every full frame interval overlapping a window is included.

Pass rules: candidate cold and warm each ≤6 s and ≤PROD+0.5 s; p95 ≤PROD+1 ms; maximum ≤PROD+one 60 Hz frame (16.7 ms plus 0.1 ms quantization tolerance); a new ≥66 ms maximum fails when PROD is below 66 ms. Inherited hitches stay labelled. This covers the requested matrix/windows on this host; it does not certify clean-driver-cache startup, every mission beat or every machine. Initial sandbox DNS/loopback restrictions were resolved before measurement; no proxy timing is used.

## Evidence and cleanup

[Fixed matrix and event indices](final-matrix.json) · [Fixed load phases and identities](final-loads.json) · [Fixed native traces](final-native.json) · [Complete original matrix](matrix.json) · [Original loads](loads.json) · [Original native traces](native.json) · [Extended original L1 low](moment-native.json) · [Profiled load phases](diagnostic-loads.json) · [CPU profiles summarized](cpu-summary.json) · [Symbol identities](profile-identities.json) · [CPU attribution](profile-attribution.json) · [Geometry equivalence and CPU measurements](frozen-equivalence.json) · [Validation receipts](validation.json) · [Independent audit](audit.json) · [Build and executable harness provenance](provenance.json) · [Commands](runs.json) · [Quiet admission](conditions.json) · [Mirror ledger](mirror.json) · [Mirror audit](mirror-audit.json) · [Request coverage](request-audit.json) · [Raw-source hashes](raw-manifest.json) · [Cleanup](cleanup.json) · [Checksums](evidence-manifest.json).

All 2,756 mirrored files (536,282,807 bytes) were rehashed, and all 2,074 embedded asset-version paths match their content hashes. Source/authoring/template literals returning SPA fallback HTML remain recorded as crawl failures and are never substituted for runtime assets. All requested runtime paths must return 200/304 and be covered by the mirror. Raw profiles, capture output, local mirror and owned candidate build are deleted after packaging and audit. Owned preview servers are stopped; the shared browser pool remains running. No deploy or push.

## Reproduction

Restore harness sources from `provenance.json` under their recorded paths (adjust the workspace prefix in native imports for another checkout), including the embedded pre-fix reference source for the equivalence benchmark. Download the live control with `node test-results/perf9/perf6-mirror.mjs`, build the chosen revision with `node test-results/perf9/build-public.mjs`, then run `node test-results/perf9/serve.mjs`. `runs.json` records exact commands/environment for every initial and fixed measurement; use fresh output directories and `quiet-run.sh`. The fixed load driver records its three sequential quality/backend commands in `final-loads.mjs`. Summarize both datasets, package the evidence, independently audit, then clean up.
