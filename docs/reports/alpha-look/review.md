# Alpha visual upgrade — 2026-10-15

The regular Alpha now has exposed rounded shoulders and chest, larger grasping hands and a stronger forward lurch. The worker's tie, lapels and small office details no longer clutter its silhouette. A dark torn vest and trousers separate from pale infected skin, red wounds and emissive eyes. This is an asset-only change: the worker and Mega builders, shared rig/clip names, hidden stump caps, health-bar implementation and all gameplay data are unchanged.

The packed Alpha is 2.582 m tall, 1.435× the 1.8 m worker. The unchanged Mega is 2.472 m tall and remains broader and more threatening through its red trapezius, white spine ridge, dark skin and oversized right fist. Both remain visibly different from the ordinary infected and courier.

| Tier | Triangles including hidden caps | Limit | KiB | Materials |
| --- | ---: | ---: | ---: | ---: |
| LOD0 | 7,777 | 8,000 | 72.42 | 4 |
| LOD1 | 2,788 | 3,000 | 34.85 | 4 |
| LOD2 | 868 | 1,000 | 24.21 | 4 |

No image textures. The four crowd material draws and existing instancing path are preserved. [Asset validation](asset-validation.json) covers both Alpha and unchanged Mega, all tiers.

## Surface integrity

The baseline far tier had conspicuous sleeve/cuff shards. LOD1/2 now voxel-union each material inside each rigid owner, then reduce it. Welded degenerate edges, triangular punctures and flattened duplicate-face islands are cleaned before export. No geometry joins different animated owners. Both authored exports have **zero boundary edges and zero non-manifold edges**, including caps, measured from exported GLB triangle positions: [topology measurements](lod-topology.json). Reproduce with `python3 docs/reports/alpha-look/topology.py assets/inf.alpha docs/reports/alpha-look/lod-topology.json`.

## Capture method

Before is commit `49d9a8a7c1ee4cee465e480afc4af926c20da776`; after uses the worktree's packed assets. The comparison script serves baseline GLBs only to the before browser, then uses a fresh context for the candidate. Both sides use identical cameras, lighting and actors. A wide 2560×720 viewport fits the courier, worker, regular Alpha and the Mega's extended fist at zoom 0.5; individual/animated catalog scenes also cover the standard 960×540 viewport. Backend checks reject WebGPU fallback. No images are used as model textures.

Reproduce comparison sheets with `SCENE_PORT=3521 E2E_PORT=3522 sh tools/e2e-lock.sh npx tsx docs/reports/alpha-look/capture.ts 49d9a8a7c1ee4cee465e480afc4af926c20da776`. LOD sheets use `tools/scenelab/lod-sheet.ts`, now with optional `--backend webgpu`.

## Validation status

- Asset validation: both requested IDs pass, all LODs.
- TypeScript and ESLint: pass. Fresh production build: pass.
- Final browser suite: **20/20 pass**, covering existing Alpha asset, physical/support specials, health bars and mixed crowds plus the new region budget checks.
- Final scene matrix: **108/108 pass**, high/low × zoom 0.5/1/1.5 × WebGL/WebGPU. [Results](matrix-results.json), [WebGL sheets](final/webgl2/index.md), [WebGPU sheets](final/webgpu/index.md). Detailed metrics are losslessly compressed as `metrics.json.gz`.
- Full-count render budgets: **64 samples pass** (seven L10 regions and L5 × two zooms × two tiers × two backends). Every region uses its production regular-Alpha cap; L5 uses both Alphas. Synthetic actors are frozen after placement so production spawning cannot compete with the fixture. This measures submitted geometry/draws, not frame time. High peaks: **187 draws / 424,639 triangles** (limits 600 / 1,500,000); low: **181 / 208,149** (limits 300 / 500,000). Both backends match. [Measurements](budgets/).

The western L5 fixture initially overlapped the cropped building footprint. The final fixture uses the adjacent walkable street; no production spawn or difficulty data changed.

## Visual review

Opened all twelve final game-camera before/after sheets and both complete front/back LOD sheets, plus animated L5 east/high, L5 west/low, L10 silhouette/low and tank/high matrix sheets. The shoulder skin separates from the dark torn vest, the chest leans forward and the hands reach farther. Red face/chest wounds and emissive eyes retain their palette. At low quality the fingers consolidate into solid hand shapes; fine clothing/blood detail is deliberately reduced. LOD1/2 no longer show the baseline's dangling cuff triangles or shredded silhouette. There are no visible holes in the inspected final views. Mega's red trapezius, white spine ridge and huge asymmetric fist remain more threatening at every inspected tier/zoom. WebGPU and WebGL match visually. Health bars and physical attack markers remain readable in motion.

The lineup is a shared perspective game camera, so projected size also depends on each actor's position. The packed bounds above establish the actual height relationship; Mega's apparent bulk is not a height increase from this change.

| Renderer / quality | Zoom 0.5 | Zoom 1 | Zoom 1.5 |
| --- | --- | --- | --- |
| WebGL high | [sheet](comparisons/webgl2-high-z0.5.jpg) | [sheet](comparisons/webgl2-high-z1.jpg) | [sheet](comparisons/webgl2-high-z1.5.jpg) |
| WebGL low | [sheet](comparisons/webgl2-low-z0.5.jpg) | [sheet](comparisons/webgl2-low-z1.jpg) | [sheet](comparisons/webgl2-low-z1.5.jpg) |
| WebGPU high | [sheet](comparisons/webgpu-high-z0.5.jpg) | [sheet](comparisons/webgpu-high-z1.jpg) | [sheet](comparisons/webgpu-high-z1.5.jpg) |
| WebGPU low | [sheet](comparisons/webgpu-low-z0.5.jpg) | [sheet](comparisons/webgpu-low-z1.jpg) | [sheet](comparisons/webgpu-low-z1.5.jpg) |

All LODs, before left / after right: [WebGL](comparisons/lods-webgl2.png), [WebGPU](comparisons/lods-webgpu.png). Run `python3 docs/reports/alpha-look/package-sheets.py` after capture to assemble the LOD comparisons and package game PNGs as full-resolution quality-95 JPEGs.

## Remote regression and timing

Native headless Chrome on the Apple M4 / ANGLE Metal, after a fresh production build and quiet-run preflight: **4.9 ms frame p95 / 0.8 ms sim p95** with 200 infected at high; **3.2 ms / 0.5 ms** with 100 at low. Each crowd included six visible Alphas, used four instanced crowd material draws, and had zero console errors. Measurements were unthrottled, 1280×720, WebGL; they do not substitute for phone-throttled or WebGPU timing. [Samples and counters](performance.json), [quiet conditions](quiet-conditions.jsonl). One bounded reservation, released after completion; no consecutive quiet batches. Reproduce with `SCENE_PORT=3521 E2E_PORT=3522 sh tools/perf/quiet-run.sh npx tsx docs/reports/alpha-look/performance-probe.ts` (externally enforce the 20-minute reservation deadline).

Full remote command: `sh tools/remote/run.sh "$PWD" -- npx vitest run tests/unit tests/sim tests/levels --maxWorkers=4`. Completed in 3,562.62 s: **2,858 passed / 9 failed / 9 skipped**, 440 passing / 7 failing / 3 skipped files. [Full log](remote-regression.log.gz). This run synced the earlier visual candidate; the final exported surface cleanup was subsequently covered by all 20 browser tests, all 108 matrix variants, validation, topology measurement and the focused asset tests.

Final focused asset tests: **12/12 pass**, `npx vitest run tests/unit/assets/alpha.test.ts tests/unit/assets/mega-alpha-dog.test.ts --maxWorkers=4` (0.946 s). The remote duplicate waited over 30 minutes for capacity and was cancelled; only these two small files ran locally, after the quiet reservation ended. No local full-unit, simulation or level sweep. [Asset log](asset-tests.log.gz), [browser log](browser.log.gz).

The broad run is **not green**. All failing test files and production code they exercise are unchanged by this asset patch:

| File | Failure |
| --- | --- |
| `tests/levels/L1.test.ts` | Complete-bot median 463.87 s exceeds 180 s; respawn-world corpse position mismatch (two tests). |
| `tests/levels/l1-forecourt.test.ts` | Both tiers stop at z=35.209 rather than below 34.5 (two tests). |
| `tests/levels/L10.test.ts` | Existing 300 s deadline exceeded. |
| `tests/sim/levels/l10-campus-corridor.test.ts` | High route ends 6.181 m away, limit 4 m. |
| `tests/unit/render/character-loading.test.ts` | Direct female load invokes loader twice, expected once. |
| `tests/unit/render/occluder-footprint.test.ts` | Mock receiver has no `cutPlacements` set. |
| `tests/unit/static.test.ts` | Existing 180 s deadline exceeded remotely; standalone local typecheck, lint and build pass. |

Baseline reproduction is **unverified**: the detached original-commit check spent over 30 minutes queued or transferring and was cancelled before test execution. Its requested files were occluder-footprint, character-loading, L1 forecourt and L10 campus/corridor. These failures are outside the changed files, but this run does not establish that every failure reproduces on baseline. [Transfer/queue log](baseline-attempt.log.gz). No test, budget or gameplay criterion was weakened. The aggregate `verify -- E07` wrapper was not run in addition to the explicit validation above.
