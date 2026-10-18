# Browser admission and optional remote runs — 2026-10-18

The deploy browser gate is **local**, with `E2E_SLOTS=2`. `scene:matrix` matches main's local WebGPU command, filter and `E2E_UNITS=2`; `test:e2e` and `scene:catalog` use local `tools/e2e-lock.sh`. Explicit `scene:matrix:remote` and `test:e2e:remote` scripts retain optional SwiftShader runs. Hetzner remains the CPU runner for unit, levels and sim work.

Kept protections: the Mac hard cap of two browsers, ten-second WindowServer CPU admission (wait above 60% or unavailable/restarted samples), and a 30-minute admission deadline. Quiet-run releases partial reservations, bounds held batches to 20 minutes, enforces a one-minute cooldown, and cleans up owned descendants. Native verifier timing phases use quiet-run. Remote Chromium setup repairs old caches and cloud-init includes browser dependencies.

Removed the remote gate script and `gpu-offload-courier`, which only inherited `seethrough-gear-four` and added no coverage. Removed bulk capture/index data and the abandoned matrix comparison helper. Retained two historical comparison sheets: [Mac Metal](captures/metal-depot-high-z1.jpg) and [remote SwiftShader](captures/swiftshader-depot-high-z1.jpg). They are sample evidence only.

The attempted remote matrix completed 13/1,026 rows in about 50 minutes (133–385 seconds per row). The orchestrator stopped it and its finalizer; full remote parity was never established. No remote matrix is a deploy gate. These protections reduce oversubscription; they cannot guarantee that macOS will never restart, and all active worktrees must adopt the wrappers.

Validation of the final trim:

- Typecheck and lint passed.
- Local `npm run scene:matrix -- --list` passed (1,020 rows, unchanged main filter).
- Hetzner `npx vitest run tests/unit/tooling --maxWorkers=4`: 67 passed, seven Mac-only lock tests skipped, one existing failure in `l7-runner-default.test.ts` (duplicate L7 in `runnerLevels`). All eight GPU-offload tests passed. The failing test and runner sources match main; no gameplay fix was included.

Logs: `/tmp/gpu-offload-2-{typecheck,lint,list,tooling}.log`. No new browser runs, renderer/gameplay changes, merge or deploy.
