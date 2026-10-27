# Mac CPU runner verification — 2026-10-27

Branch: `lane/mac-runner`. Implementation and usage are documented in
[remote-runner.md](../tools/remote-runner.md).

## Completed checks

| Check | Result |
| --- | --- |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass; focused ESLint rerun after the pool adapter correction also passed |
| Shell syntax, Python compilation, Node syntax, `git diff --check` | Pass |
| `python3 -I tools/remote/check.py --unit` on macOS | 15 checks, 12 passed and 3 worker checks intentionally skipped |
| Full focused checks on Linux runner `88.99.168.213` | 13 checks, 12 passed and the macOS-only CLI lock check skipped |
| Actual Linux slot-lock probe | Pass: reported 2, 1, 0 occupied slots as two fixture locks were released |
| Vitest `@smoke`, two workers | 6 passed, 4,097 skipped; 479.38 s on the loaded remote host |
| Production build on that runner | Pass, 46.09 s |
| Chromium `@smoke`, two workers | **Failed:** 3 passed, 19 failed; 1,007.25 s |

Focused coverage includes FIFO/dead-owner cleanup, remote full/unreachable admission,
real macOS `lockf(1)` refusal, load/RAM boundaries, one local slot, worktree/env/results,
timing receipts, exit-code preservation (including 75), four-worker enforcement,
and finishing the current file before pausing/resuming without duplicates. Pool
admission also checks actual slot locks, so one timing job holding both slots
cannot appear to leave capacity free. A lightweight fake API check proves the adapter resolves Vitest from the requested
worktree, even when the launcher has a different installation. The
additional benchmark unit check rejects non-overlapping Vitest execution receipts.

Browser smoke passed audio backgrounding and both foundation checks (boot/screenshot
and three empty-scenario reloads). Eight gameplay/WebGL cases timed out; eleven
WebGPU cases reported renderer or console errors. These are recorded failures,
not a green browser gate. Repository test and product source files were not changed.
The native browser gate still needs its normal Mac validation.

Raw local evidence is under ignored `test-results/mac-runner/`, with the pulled
browser JSON at `test-results/playwright/results.json`.

## Throughput measurement

Acceptance remains incomplete until four real `test:gate` runs have completed
before and after, with receipt-confirmed overlap of three remote jobs and one
local job. The harness is `tools/remote/benchmark.py`; it rejects cancelled,
failing, or unproven comparison attempts while retaining their evidence.

Setup attempts were cancelled while queued, when an older client joined the
runner, or when the Mac admission window changed. None is a completed throughput
measurement. Their raw evidence remains under `test-results/mac-runner-demo*/`.
The harness now uses the existing `timing-isolated.sh --whole-run` wrapper to
hold both remote slots for each command; Mac fallback expands that known wrapper
to its validated CPU command. One detached worktree at `e925a6232` contains
cleanup's gate/nightly partition. Current evidence is written outside that
worktree under `test-results/mac-runner-demo-window3/`. The enabled configuration
is measured first to use the Mac window, followed by the remote-only baseline
against the same revision and package. Comparison proof must use overlapping
test-file intervals; a local job paused throughout remote execution does not count.
The worktree must be removed as soon as its needed measurements are recorded;
at most one benchmark worktree may exist.

At 08:12 CET the Mac passed admission (load 2.04, 4.22 GiB free physical RAM).
GPU work resumed before a local job could start. Admission was not bypassed.
This implementation counts free physical pages only; counting reclaimable
inactive memory would change the documented admission policy. The merged cleanup
report records existing gate failures in `main:docs/qa/tests-cleanup.md`.
