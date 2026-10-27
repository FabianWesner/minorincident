# Mac CPU runner verification — 2026-10-27

Branch: `lane/mac-runner`. Implementation and usage are documented in
[remote-runner.md](../tools/remote-runner.md).

## Completed checks

| Check | Result |
| --- | --- |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass; focused ESLint rerun after the pool adapter correction also passed |
| Shell syntax, Python compilation, Node syntax, `git diff --check` | Pass |
| `python3 -I tools/remote/check.py --unit` on macOS | 14 checks, 11 passed and 3 worker checks intentionally skipped |
| Full focused checks on Linux runner `88.99.168.213` | 13 checks, 12 passed and the macOS-only CLI lock check skipped |
| Vitest `@smoke`, two workers | 6 passed, 4,097 skipped; 479.38 s on the loaded remote host |
| Production build on that runner | Pass, 46.09 s |
| Chromium `@smoke`, two workers | **Failed:** 3 passed, 19 failed; 1,007.25 s |

Focused coverage includes FIFO/dead-owner cleanup, remote full/unreachable admission,
real macOS `lockf(1)` refusal, load/RAM boundaries, one local slot, worktree/env/results,
timing receipts, exit-code preservation (including 75), four-worker enforcement,
and finishing the current file before pausing/resuming without duplicates. The
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

The first baseline attempt was cancelled while all four commands were queued,
and its 2.3 GB worktree was removed. It is not a throughput measurement. A second
baseline uses one detached worktree at `e925a6232`, the merge containing cleanup's
gate/nightly partition. Evidence is written outside that worktree under
`test-results/mac-runner-demo-window1/`. The worktree must be removed as soon as
its needed measurements are recorded; at most one benchmark worktree may exist.

At the start of this attempt, all three remote hosts were occupied. The Mac
refused admission because GPU/browser reservations were active; sampled free
physical RAM was also below 4 GiB. Admission was not bypassed. This implementation
counts free physical pages only; counting reclaimable inactive memory would be
a change to the documented admission policy. The merged cleanup report also
records existing gate failures: [tests-cleanup.md](../qa/tests-cleanup.md).
