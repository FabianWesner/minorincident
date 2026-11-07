# r2-l10perf — L10 first-use charge hitch

**Status: source warm-up gap corrected; post-fix performance pending.** The ≤66 ms frame target and ≤6 s cold-load target remain unverified on the final candidate.

## Item and cause

| Item | Status | Evidence |
|---|---|---|
| L10 high first-use hitch near charge tick 260 | Warm-up gap fixed; acceptance pending | The base, black and cream dog corpse pages already exist before charging, but their `corpse_pal_picketWhite` graphs first build at charge tick 251. Streamed living meshes were compiled separately from their sibling corpse pages. Demand-loaded encounter models could also arrive before the background-stream flag was enabled. |

The new baseline trace identifies all three dog materials by page name and material ID, and confirms that each page existed before capture. The historical perf8 trace has the same three builds at charge tick 251, followed by its maximum at tick 260. [Original window](original-window.json) · [Controlled baseline](baseline.json).

L10 now compiles both the living batch and its prepared corpse pages through the existing hidden HDR/MSAA compile queue. The owner skips initial-loading calls until the scene is prepared, so this covers corridor demand loads as well as background streaming. Living meshes retain their detached compilation barrier, and level disposal stops further page warm-ups. Other levels retain their existing warm-up policy. Source commits: `fd0c66b`, `8a23a20`, `a3f867d`.

## Numbers

| Run | Full 90 s max / p95 ms | Charge 180–350 max ms | Late dog corpse graphs | Cold load s |
|---|---:|---:|---:|---:|
| Historical perf8 candidate | 250.0 / 16.8 | 250.0 | 3 at tick 251 | 3.025 |
| Current baseline, `daada5d` | 50.0 / 16.8 | 33.3 | 3 at tick 251 | Pending |
| Final candidate, `a3f867d` | Pending | Pending | Pending; must be 0 | Pending |

Historical PROD measured 216.6 ms at charge tick 260. The current controlled baseline did **not** reproduce that large pause, even with Chromium/Dawn persistent caching disabled; its maximum was 50.0 ms and it had zero page/console errors. The baseline still reproduces the late graph builds, making those builds a concrete regression check. The baseline's 50.0 ms is not a measured improvement from this fix.

The candidate check uses the original perf8 authored route and native complete-bot InputFrames, high WebGPU, seed 1, zoom 1.5, 1280×720/DPR 1, and a complete 90-second charge capture. The perf8 setup uses an invulnerable courier, a saved objective prefix, and ordinary movement along the authored route; VFX are enabled for capture. It rejects late dog corpse builds, any frame above 66 ms, errors, or a non-gameplay boundary. Public-menu cold loads follow in fresh headless Chrome processes in the same exclusive quiet reservation.

Cache controls are `--disable-gpu-shader-disk-cache` and `--enable-dawn-features=disable_blob_cache`; their meanings are documented in [Chromium](https://chromium.googlesource.com/chromium/src/gpu/+/master/config/gpu_finch_features.cc) and [Dawn](https://dawn.googlesource.com/dawn/+/refs/heads/main/src/dawn/native/Toggles.cpp). No global macOS Metal cache was reset. These are individual observations, not a latency distribution.

## Perf admission

**Perf pending.** The final candidate received no quiet admission between 2026-11-07T06:42:55.395Z and 2026-11-07T07:03:07Z (20.2 minutes). The 40 logged samples ranged from **4.33 to 17.56**, above the required load <3. The initial sandbox restrictions were resolved; host load blocked this final window. One final E32 gate ran while admission was closed and finished before the later attempts. All attempts are terminal and the owned 4973/4974 servers are stopped. [Admission evidence](admission.json).

## Validation and reproduction

`npm run verify -- E32` passed on `a3f867d`: typecheck, lint, **27 test files / 107 tests**. [Gate receipt](checks.json). An earlier run on an uncommitted source correction failed the review-freshness fixture; committing that correction and rerunning the gate resolved it. No test or threshold was changed.

[Provenance](provenance.json) retains the build/source hashes and harness sources. Restore the harness files under their recorded paths, replacing the workspace prefix if needed. Build the pair, build the shared public adapter, and start the owned static server on 4973/4974. Use fresh output directories and `tools/perf/quiet-run.sh` for each measurement. The final harness refuses to open Chrome with less than three minutes left in its ten-minute reservation; after capture it runs both public cold-load checks.

No deploy or push. No captures are committed.
