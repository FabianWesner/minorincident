# r2-l10perf — L10 first-use charge hitch

**Fixed for the brief's first-use target:** late dog-corpse graph builds **3 → 0**, first-charge window **50.0 ms ≤66 ms**, and cold load **3.273 s ≤6 s**. The separate whole-capture guard's initial failure is retained below.

## Item and cause

| Item | Verdict | Evidence |
|---|---|---|
| L10 high first-use hitch near charge tick 260 | **Fixed; requested targets pass** | Base, black and cream dog corpse pages existed before charging, but first built their `corpse_pal_picketWhite` graphs at tick 251. L10 now warms those pages before first use. Both candidate captures have zero late dog-corpse graph builds and retain 14 visible dog-corpse instances. |

The historical perf8 trace shows three corpse graphs at charge tick 251 followed by the maximum at tick 260. The fresh baseline identifies the three dog coats by page name/material ID and confirms that their pages already existed before capture. [Original window](original-window.json) · [Baseline](baseline.json).

The gap was in `CrowdView.loadBatch`: its living mesh was warmed separately from its sibling corpse pages, and demand-loaded models could arrive before the background-stream flag was enabled. L10 now sends both living batches and prepared corpse pages through the existing hidden HDR/MSAA compile queue. The owner skips initial-loading calls until the scene is prepared, covering corridor demand loads and background streaming without adding shader compilation to cold load. Living meshes retain their detached compilation barrier; disposal stops subsequent page warm-ups. Other levels retain their warm-up policy. Source commits: `fd0c66b`, `8a23a20`, `a3f867d`.

## Numbers

| Run | Full 90 s max / p95 ms | Charge 180–350 max ms | Late dog-corpse graphs | Cold load s |
|---|---:|---:|---:|---:|
| Historical perf8 candidate | 250.0 / 16.8 | 250.0 | 3 at tick 251 | 3.025 |
| Fresh baseline, `daada5d` | 50.0 / 16.8 | 33.3 | 3 at tick 251 | 3.192 |
| Initial final candidate, `a3f867d` | **66.7** / 16.8 | **50.0** | **0** | **3.273** |
| Predeclared confirmation, same candidate | 50.1 / 16.8 | 33.3 | **0** | — |

The interval containing the original trigger, charge ticks 240–280, peaks at **16.8 ms in both candidate captures**. The wider first-use window above passes in the initial capture as well as the confirmation. Cold load changed by +0.081 s in this single fresh-process pair and stays below 6 s. [Candidate](candidate.json) · [Cold loads](loads.json) · [Confirmation](confirmation.json).

The added, stricter **whole-90-second ≤66 ms guard failed initially**: one 66.7 ms frame occurred at +59.717 s, charge=3600, after charge completion. No new material graph build coincided with it. Its cause is unproven. A single predeclared unprofiled confirmation recorded 50.1 ms maximum and zero errors; the later frame did not recur. The initial failure remains in the trace and audit. The brief's tick-260 target passed in that initial run; this report does not certify every L10 frame below 66 ms.

Historical PROD measured 216.6 ms at tick 260. The fresh baseline did not reproduce the historical large pause, so the 250.0 →50.0 comparison is not credited as a measured causal speedup. The demonstrated regression fix is removal of the three first-use dog-corpse graphs, with visible corpses preserved.

## Method and limits

All timing runs used `tools/perf/quiet-run.sh`, exclusive admission with load <3, and one headless native Metal WebGPU context at a time. Native captures use the original perf8 authored route and complete-bot InputFrames, high quality, seed 1, zoom 1.5, 1280×720/DPR 1, and full 90-second coverage. The setup uses an invulnerable courier, a saved objective prefix, and ordinary movement along the authored route; VFX are enabled for capture. Both candidate captures have zero page/console errors and zero non-gameplay frames.

Cold loads use the uninstrumented public menu at 1600×900/DPR 1, high quality, with a fresh Chrome process/profile for each side. Chromium/Dawn persistent caching is disabled using `--disable-gpu-shader-disk-cache` and `--enable-dawn-features=disable_blob_cache`; see [Chromium](https://chromium.googlesource.com/chromium/src/gpu/+/master/config/gpu_finch_features.cc) and [Dawn](https://dawn.googlesource.com/dawn/+/refs/heads/main/src/dawn/native/Toggles.cpp). No global macOS Metal cache was reset. Historical perf8 used its earlier context-cache method. These are individual observations, not a latency distribution.

Earlier admission attempts were reported **perf pending** after 20.2 minutes with logged loads 4.33–17.56. The resumed candidate, cold-load pair and confirmation were subsequently admitted. All attempt results and admission conditions are retained. [Admission evidence](admission.json).

## Validation and reproduction

`npm run verify -- E32` passed on the final source commit `a3f867d`: typecheck, lint, **27 test files / 107 tests**. [Gate receipt](checks.json). An earlier uncommitted correction failed the same-commit review-freshness fixture; committing the correction and rerunning resolved it. No repository test or threshold was changed.

[Requirement audit](audit.json) · [Provenance, source/build hashes and complete harness sources](provenance.json) · [Evidence checksums](evidence-manifest.json).

Restore the recorded harness files, replacing the workspace prefix if needed. Build the pair and shared public adapter, then start the owned server on 4973/4974. Use the recorded commands through `quiet-run.sh` with fresh output directories. The frame harness refuses to open Chrome with less than three minutes left in its reservation. Its stricter whole-capture guard can exit nonzero after saving a complete trace; the separate cold-load command and confirmation are recorded explicitly.

All checks are terminal; owned servers are stopped and browser leases released. No deploy or push. No captures are committed.
