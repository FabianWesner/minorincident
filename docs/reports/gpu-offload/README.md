# GPU offload — 2026-10-18

Implementation on `lane/gpu-offload`. Full remote proof is **in progress**, not a green deploy gate. No deployment or merge.

## Changes

- `npm run scene:matrix` defaults to remote WebGL2. `scene:catalog -- --matrix --backend webgl2` also builds and renders the synced worktree on Hetzner with SwiftShader. Trailing backend/output overrides work. Catalog artifacts, including failed rows, return to the requested worktree directory. WebGPU stays local; `--list` needs no browser or remote sync. Default ports derive from the wrapper PID, and explicit lane ports remain supported.
- `npm run test:e2e` routes functional Chromium e2e to Hetzner, one worker. Native WebGPU/`@gpu` and timing/`@perf` cases retain local gates. The shared worker fixture normalizes older per-file Metal overrides on Linux and rejects uncapped flags outside quiet-run.
- `tools/remote/browser-setup.sh` installs the pinned Chromium and system dependencies for both existing snapshots and new caches, under a setup lock. Failed installation cannot create the success marker; a missing executable triggers repair. Cloud-init includes Chromium libraries/fonts. No dependencies or licenses changed.
- The ignored `/Users/wesner/Workspace/minorincident/epics-pipeline/gate-browser.sh` was edited in place. Its reviewable counterpart is `tools/remote/gate-browser.sh`: remote functional smoke, full WebGL2 matrix and selected e2e; local full WebGPU matrix, native e2e/smoke and quiet native look checks. Failures propagate. It is a full script so the ignored entry point is runnable before this branch's helper is integrated; tracked changes still need integration into the worktree being gated.
- `tools/e2e-lock.sh` hard-caps Mac capacity at two, independently of `E2E_SLOTS`. Before admission it samples WindowServer CPU time over ten seconds; >60%, an unavailable/restarted sample, or existing headless browser roots plus the reservation exceeding two cause waiting. GPU/renderer subprocesses and scheduler text are excluded. Admission stops after 30 minutes.
- Uncapped Scene Lab probes require quiet-run. Native verifier phases that selected uncapped tests now use it. Quiet-run releases partial reservations during contention, reserves all legacy slots, and bounds its held batch to 20 minutes including cleanup. A shared one-minute cooldown gives functional lanes an admission opportunity between quiet batches. Timeout/cancellation cleanup signals only descendants of the owned command, including detached browser roots; PID start times guard against reuse.

No renderer, gameplay, asset, spec, visual threshold or performance budget changes. `src/assets/staticCollision.ts` has no diff. Admission protection cannot guarantee that macOS or browsers launched outside the wrappers will never hang.

## Validation

| Check | Result / evidence |
| --- | --- |
| Typecheck, lint, fresh production build | Passed; local logs `/tmp/gpu-offload-{typecheck,lint,build}.log` |
| Focused tooling checks | 21 tests passed across GPU guard, lock, verifier quiet and remote tests; `/tmp/gpu-offload-tooling.log` |
| WebGPU routing scene | 6/6 high/low × zoom 1.5/1/0.5 rows passed, 14 s, `test-results/gpu-offload-webgpu/index.json` |
| Native canvas regression | 8/8 passed, 1.3 min, both qualities and both zoom limits; `/tmp/gpu-offload-webgpu.log` |
| Mac WebGL2 comparison sample | **280/280 passed**, exactly 60 authored scenes, **1,493.209 s** wall time; [retained index](mac-sample-index.json), `test-results/gpu-offload-mac-webgl2/` |
| Full remote WebGL2 matrix | Running: 1,026 rows, unchanged filter/size/gates; `test-results/gpu-offload-matrix/` will be pulled automatically |
| Remote functional deploy e2e | Running 67 selected tests; first `crowd-visible-outbreak` attempt hit its unchanged 180 s deadline; retry pending; `/tmp/gpu-offload-e2e.log` |
| Full unit + sim + tests/levels | Running on Hetzner, at most four workers; timing project owns both runner slots before functional work; `test-results/gpu-offload-final/` will be pulled |
| E18 simulation | Isolated remote high 200-infected ≤4 ms and low 100-infected ≤6 ms checks passed inside the ongoing full suite |
| E18 native frame timing | **Passed**, Apple M4/Metal high 200 infected, **p95 6.6 ms ≤16.7 ms**, p50 4.1 ms; 68 draws / 500,362 triangles; [full recording](desktop-gpu.json), `/tmp/gpu-offload-e18.log` |

The first remote matrix rows passed but took **133–307 s each**. This is actual software-rendering evidence, not a completed wall-time measurement or native frame-time evidence. At the initial rate, the full matrix is an overnight run. No resolution, capture count, scene list, gate or budget was reduced to accelerate it. The full catalog must finish before claiming full remote success or 60-scene parity. Functional tests whose rendered-frame workload exceeds existing software-rendering deadlines also remain red; no timeout was increased.

The first CPU sweep began from an incomplete sync manifest while the helper was being added; its missing-helper errors are superseded by the stable full rerun. It also exposed two unchanged baseline failures: `runnerLevels` includes L7 twice (`tests/unit/tooling/l7-runner-default.test.ts`), and no test carries `@E29-AC01` (`tests/unit/traceability.test.ts`). Those files were not changed.

## Captures inspected

`gpu-offload-courier` is added to the matrix catalog and inherits the existing geared-courier scene with zero console errors/undrawn frames and the low-tier E18 limits (300 draw calls, 500,000 triangles). It runs at both tiers and all three zooms on both backends. The completed Mac sample has no failed row.

I inspected the [WebGL2 high z1](captures/webgl2-high-z1.jpg), [WebGL2 low z0.5](captures/webgl2-low-z0.5.jpg), [WebGPU high z1](captures/webgpu-high-z1.jpg) and [low z0.5](captures/webgpu-low-z0.5.jpg) game-camera sheets: the cap, ponytail, backpack, blue clothing, shoes and contact shadow remain drawn against cracked asphalt; the closer view has no missing body or black frame. The full-level L4 high-z1 and low-z0.5 captures under `test-results/webgpu-blank/game/` show the evacuation bus, ground and HUD; the closer composition is bus-dominated, so this is canvas-rendering evidence rather than a character-readability claim.

I also inspected the returned [SwiftShader depot sheet](captures/swiftshader-depot-high-z1.jpg) beside the [Mac Metal sheet](captures/metal-depot-high-z1.jpg). Road markings, pavement, hydrant, lamps, houses, awning and shadows have consistent composition and color across the six camera frames. The JPEG files are not byte-identical; no pixel-identity claim is made. Both row gates passed. This one view does not establish 60-scene parity.

The [native E18 capture](captures/e18-desktop.png) shows the full 200-infected cluster on the tiled test ground with visible heads, bodies and contact shadows; there is no blank frame. This recording proves the specified native frame-time check, not every E18 criterion. The Mac sample and native timing browsers have closed and released their reservations.

## Finish / reproduce the pending proof

Active local followers (remote jobs run in detached sessions and results are pulled before cleanup):

- Matrix: `/tmp/gpu-offload-matrix.log`; runner `94.130.181.173`, job `/srv/mi/jobs/gpu-offload-6f8d83-67997-1792327624`.
- Full CPU suites: `/tmp/gpu-offload-final-heavy.log`; runner `2.28.24.66`, job `/srv/mi/jobs/gpu-offload-6f8d83-68077-1792327625`.
- Selected functional e2e: `/tmp/gpu-offload-e2e.log`; runner `2.28.24.66`, job `/srv/mi/jobs/gpu-offload-6f8d83-68252-1792327626`.
- New routing scene on remote SwiftShader: `/tmp/gpu-offload-remote-proof.log`; output `test-results/gpu-offload-remote-proof/`.

After the full catalog and Mac sample have returned, run:

```sh
python3 tools/scenelab/compare-catalog.py \
  docs/reports/gpu-offload/mac-sample-index.json \
  test-results/gpu-offload-matrix/index.json \
  --out docs/reports/gpu-offload/comparison.json
```

The comparison requires exactly 60 distinct authored sample scenes and checks every sampled quality/zoom row. Missing rows or any pass/fail difference fail it. It records both wall times; a matching failure still leaves the full catalog red. Update this report with the completed full-run results before treating the deploy gate as green. No epic completion or `verify -- E<NN>` completion is claimed: this is infrastructure work, and the native E18 probe is a budget regression check.
