# perf10 — batch-57 performance vs live batch 56

**PASS: 15/15 matrix cells and 9/9 named event windows.** All candidate captures stay below 66 ms (largest frame 50.1 ms). The verdict below is the fresh complete unprofiled paired matrix on source `fdb71aacd79f3f6e0564798a3a8fc8de55400131`.

Candidate: fresh `MI_BUILD_CACHE=off npm run build`, bundle `index-XVRWzTu7.js`, SHA-256 `9af8e820532bbd85dd2cfdd8be0525aebce17e1b9c727795af6c37f9319ae9b3`. Control: fresh [live PROD](https://minor-incident.com/) batch 56 mirror, bundle `index-DbFAIX8_.js`, SHA-256 `71dabceb1895250205ad7cdca0592f729930caf60867843113a29fc90b32eded`. The index changed between the 16:02 UTC mirror and final audit to `index-DkTUBysS.js` (the original 213b8480 baseline build). The requested batch-56 bundle remains available live with the exact original hash. All paired measurements keep batch 56 as their control; no performance threshold or measured control bytes changed. See [final live identity](live-control-final.json) and the [initial audit finding](initial-audit.json).

## Verdict table

Loads are cold/warm seconds; frame values are milliseconds, PROD → candidate. Every WebGPU cell covers a full native gameplay minute; both L1 tiers and L10 high cover 90 seconds.

| Scope | Cell / moment | PROD cold / warm s | Candidate cold / warm s | p95 ms P → C | Max ms P → C | Verdict |
|---|---|---:|---:|---:|---:|---|
| WebGPU | L1 low | 1.992 / 1.928 | 1.962 / 1.895 | 16.7 → 16.7 | 33.4 → 33.3 | PASS |
| WebGPU | L3 low | 2.859 / 2.744 | 2.990 / 2.943 | 16.7 → 16.7 | 16.8 → 16.8 | PASS |
| WebGPU | L4 low | 3.058 / 2.961 | 3.074 / 2.944 | 16.8 → 16.7 | 416.7 → 33.3 | PASS |
| WebGPU | L5 low | 2.625 / 2.527 | 2.591 / 2.544 | 16.7 → 16.8 | 33.4 → 50.1 | PASS |
| WebGPU | L7 low | 2.627 / 2.461 | 2.756 / 2.644 | 16.8 → 16.8 | 100.0 → 33.3 | PASS |
| WebGPU | L10 low | 3.309 / 3.194 | 3.257 / 3.196 | 16.8 → 16.7 | 433.3 → 49.9 | PASS |
| WebGPU | L1 high | 1.845 / 1.842 | 1.861 / 1.826 | 16.7 → 16.7 | 50.0 → 33.4 | PASS |
| WebGPU | L3 high | 2.559 / 2.472 | 2.724 / 2.707 | 16.7 → 16.7 | 16.8 → 33.4 | PASS |
| WebGPU | L4 high | 3.424 / 3.339 | 3.408 / 3.276 | 16.8 → 16.8 | 33.4 → 50.0 | PASS |
| WebGPU | L5 high | 2.473 / 2.358 | 2.456 / 2.392 | 16.7 → 16.7 | 33.4 → 33.3 | PASS |
| WebGPU | L7 high | 2.842 / 2.755 | 3.306 / 3.205 | 16.8 → 16.8 | 50.0 → 33.2 | PASS |
| WebGPU | L10 high | 2.992 / 2.889 | 2.989 / 2.940 | 16.8 → 16.8 | 66.7 → 50.1 | PASS |
| WebGL2 load / G-01 | L1 low | 2.227 / 2.144 | 2.212 / 2.176 | — | — | PASS |
| WebGL2 load | L4 low | 3.210 / 3.107 | 3.344 / 3.205 | — | — | PASS |
| WebGL2 load | L7 low | 2.759 / 2.671 | 3.042 / 2.921 | — | — | PASS |
| Moment | L1 handover/outbreak low | — | — | 16.7 → 16.7 | 16.8 → 16.8 | PASS |
| Moment | L1 handover/outbreak high | — | — | 16.8 → 16.7 | 33.3 → 33.4 | PASS |
| Moment | L7 pickup low | — | — | 16.8 → 16.7 | 16.8 → 16.7 | PASS |
| Moment | L7 first rocket low | — | — | 16.8 → 16.7 | 16.8 → 16.7 | PASS |
| Moment | L7 pickup through first rocket low | — | — | 16.8 → 16.7 | 16.8 → 16.7 | PASS |
| Moment | L7 pickup high | — | — | 16.7 → 16.7 | 16.7 → 16.7 | PASS |
| Moment | L7 first rocket high | — | — | 16.7 → 16.8 | 16.8 → 16.8 | PASS |
| Moment | L7 pickup through first rocket high | — | — | 16.7 → 16.8 | 16.8 → 16.8 | PASS |
| Moment | L10 charge through completion (+2 s) high | — | — | 16.8 → 16.8 | 66.7 → 50.1 | PASS |

## Causes and fixes

The retained perf9 frame clocks locate the original maxima at L4 low **tick 2391 / +5.842 s**, L4 high **tick 2357 / +5.292 s**, L10 high **tick 60571 / +5.106 s**, and L7 low **tick 35 / +0.576 s**. These are the actual recorded frame ticks, rather than frame-index estimates.

The new baseline profiles reproduce L4 low/high at **83.3/83.2 ms** and L10 high at **66.7 ms**. Their worst frames spend approximately **52/48/45 ms** in the weighted skin helper underneath `repairDeathPoses` in the **main-thread worker message handler**. The workers fetched/inflated the delivered geometry, but its death-pose floor searches still ran after delivery on the render thread. Repair now runs inside the existing worker before transfer; its completion receipt restores the main-side repair/reach caches, preventing a second repair. Clip-name constants were separated from animation-library initialization so the workers do not load authored animation data just to identify death rows. Worker failure retains the existing source preparation path.

The worker-only diagnostic removes that main-thread repair cost and brings L4 to **33.3 ms low / 50.0 ms high**. L10 then exposes a different **66.6 ms** frame at **tick 60594**: construction of a newly streamed Alpha hero material. L10 now shares its existing per-layout Alpha shader across living LODs, rebinding each draw's own pose and atlas. The retained corpse still binds **its LOD0 atlas**, including when the far tier is requested first. Both native backends verify all **eight Alpha looks × three living LODs** and all eight frozen atlas bindings; the two shader layouts retain separate regular/Mega behavior. The later diagnostic peaks at **33.4 ms**.

L7 high's additional resident appearances also made loading more expensive. The baseline warm-load profile measures **148.4 ms** inside main-thread death-pose repair. Beyond moving that work to workers, atlas-specific civilian material copies were creating equivalent corpse output/normal graphs: a controlled eight-atlas check has **eight → one corpse shader keys**, while retaining all eight material/atlas identities. An exact rigid-vertex skin path avoids blending an already premultiplied joint matrix again. The five required civilian weapon assets now download in parallel before registration in the original order, removing an unnecessary serial barrier ahead of resident preparation. No model/LOD warm-up coverage, actor population, corpse, effect, setting, or acceptance threshold was reduced.

The perf9 L7 low outlier occurs after the first rocket launches (tick 22) and before impact (tick 40), with no recorded material graph build in that frame. It does not reproduce in a fresh original-source minute (**33.4 ms maximum**) or the baseline/fixed short CPU-profiled opening captures (**16.8 ms**); no speculative projectile warm-up is credited. The independent final minute and all pickup/rocket windows are included above.
The additional first-rocket trace series records 12 base captures (maximum 16.8 ms), 6 fixed captures (maximum 16.8 ms). No capture reproduces the historical 66.6 ms frame. Every attempt remains in [first-rocket attribution](first-rocket-attribution.json); these diagnostic captures do not replace the full paired matrix. The historical outlier has no retained CPU/GPU timeline, so its exact cause remains unproven; no GC, streaming, or projectile explanation is asserted.


## Fidelity and validation

The real browser preparation worker returns **30/30 full delivered buffers bit-identical** to the synchronous reference, including humanoids, prone Alpha clips, animals, and crawlers across all three LODs. The transfer-cache regression verifies the main renderer preserves both repaired pose rows and corpse reach without repairing twice.

The rigid-matrix optimization retains **288/288 actual-asset corpse geometries**, **24/24 repaired clips**, and **19,350 sampled full/vertical matrices** bit-for-bit, including positions, normals, colors, parts, UVs, indices and bounding spheres. Its isolated alternating-order CPU comparison is **304.6 → 245.8 ms** for frozen geometry and **99.1 → 80.4 ms** for pose fitting (about **1.24× / 1.23×**). These are CPU microbenchmarks, not end-to-end latency claims; the paired table is separate.

- `npm run typecheck`: PASS (11.3 s).
- `npm run lint`: PASS (7.8 s).
- `npm run test:unit`: PASS (25.8 s).
- `npm run verify -- E18`: PASS (45.7 s).

The unit suite passes **27 files / 107 tests**. `verify -- E18` runs the current per-change gate; no retired per-AC selection is claimed. The fresh final production build passes public QA-hook exclusion (**21 HTML/JS files**).

Source commits, one per cause:

- `a582ffd6` — Repair delivered crowd death poses in preparation workers
- `ec14912a` — Share corpse palette graphs across atlas material copies
- `b4268285` — Reuse L10 Alpha shaders across hero and far LODs
- `648cd959` — Copy rigid skin matrices directly from prepared poses
- `fdb71aac` — Download civilian weapon props in parallel before crowd preparation

## Method and limits

Apple M4 / macOS 26.5.1 (25F80), Chromium 153.0.8010.12 / Playwright 1.63.0; headless native Metal WebGPU and ANGLE Metal WebGL2, 1280×720, DPR 1, seed 1. Every timing command enters through `tools/perf/quiet-run.sh` with exclusive browser admission, one-minute load below 3, no busy foreign work, and one context at a time. Cooldown/wait samples are retained separately from terminal quiet admission. Cold means a fresh isolated context; warm is its reload. GPU/driver caches remain shared.

Public menu loads use original public bytes and measure level-button click through loading-card closure. G-01 confirms Begin mission on L1 low WebGL2 cold. Native gameplay uses the perf9 bootstrap-only Game exposure and the same current-source test-control adapter on both public bundles; each bundle retains its own simulation, rendering and content. Public CPU/crowd probes are compiled out; attribution uses CPU profiles and object/build instrumentation, with world counts for populations. The complete bot supplies ordinary InputFrames; god mode prevents death during timing. L1 withholds only the terminal exit movement to keep the measured level loaded. L7/L10 begin automatically. No diagnostic/profiled run supplies a final verdict.

L1 covers handover through infected exit plus two seconds. L7 pickup covers 100 ms before collection through 250 ms after; first rocket covers 100 ms before firing through 250 ms after its first native detonation; the combined window spans pickup through that impact. L10 covers charging through first completion plus two seconds. Every full frame interval overlapping a window is included.

Unchanged pass rules: candidate cold and warm each **≤6 s and ≤PROD+0.5 s**; p95 **≤PROD+1 ms**; maximum **≤PROD+one 60 Hz frame** (16.7 ms plus 0.1 ms quantization tolerance); a new **≥66 ms** maximum fails when PROD is below 66 ms. Inherited hitches, if any, remain identified in the JSON matrix. This proves the requested routes/windows on this host, rather than clean-driver startup or every machine.

## Evidence and cleanup

[Matrix/event indices](matrix.json) · [Public loads](loads.json) · [Native frame/event traces](native.json) · [Diagnostic loads](diagnostic-loads.json) · [Diagnostic native traces](diagnostic-native.json) · [CPU attribution](cpu-summary.json) · [Mapped symbols](profile-identities.json) · [Worker byte equivalence](worker-equivalence.json) · [Geometry/matrix equivalence](frozen-equivalence.json) · [Graph identity before](graph-cache-before.json) / [after](graph-cache-after.json) · [Both-backend Alpha bindings](alpha-bindings.json) · [Validation](validation.json) · [Independent audit](audit.json) · [Executable harness and build/source provenance](provenance.json) · [Commands](runs.json) · [Admission](conditions.json) · [Mirror](mirror.json) · [Mirror rehash](mirror-audit.json) · [Asset versions](asset-version-audit.json) · [Runtime request audit](request-audit.json) · [Final live identity](live-control-final.json) · [Initial audit finding](initial-audit.json) · [Raw hashes](raw-manifest.json) · [Cleanup](cleanup.json) · [Checksums](evidence-manifest.json).

All **2,756 mirrored files (536,282,807 bytes)** and **2,074 embedded asset-version paths** are rehashed. The 391 recorded crawl refusals are non-deployed source/template paths or SPA fallback responses; no requested runtime file is substituted. All final runtime requests must return 200/304 and the audit checks mirror coverage.

All 2,963 owned raw files and the owned production build are deleted. Owned preview servers are stopped, browser reservations are released, and the shared browser pool is left running. No deploy or push.

## Reproduction

Restore the harness sources and CPU reference sources embedded in `provenance.json` under their recorded paths; adjust the absolute native imports for another checkout. Restore the pinned control with `node test-results/perf10/restore-batch56.mjs`: it uses `mirror.json` plus the exact original HTML in `live-control-final.json`, rehashes every file, and refuses unavailable/changed bytes. `perf6-mirror.mjs` records the initial fresh crawl and intentionally refuses the site's newer index. Build the source commit with `build-public.mjs`, and start `serve.mjs` on 4901/4902. Run `BROWSER_POOL_JOB_ID=perf10 node test-results/perf10/final-batch.mjs`, then `python3 test-results/perf10/summarize.py final`. Exact commands/environments, quiet admissions, bundle hashes, validation and source diffs are retained. Package and independently audit before deleting owned raw output and stopping the owned servers.
