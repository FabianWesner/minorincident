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
| Full focused checks on Linux runner `88.99.168.213` | 15 checks, 14 passed and the macOS-only CLI lock check skipped (final rerun: 12.731 s) |
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

**BLOCKED: the required throughput comparison has not been completed.**

Setup attempts were cancelled while queued, when an older client joined the
runner, or when the Mac admission window changed. The final enabled attempt
used whole-run remote isolation and the frozen revision `e925a6232`; it completed
three remote gates and never admitted a local gate. Its fourth command was
cancelled while waiting for both remote slots near the three-hour task limit.
Raw evidence is retained under `test-results/mac-runner-demo-window3/after/`.

| Completed command | Passed | Failed | Skipped | Queue/sync/command wall s |
| --- | ---: | ---: | ---: | ---: |
| 1 (remote) | 3689 | 7 | 401 | 2673.71 |
| 3 (remote) | 3693 | 3 | 401 | 2993.20 |
| 4 (remote) | 3684 | 12 | 401 | 2522.97 |

Each completed receipt contains 4,097 tests. These failed runs are diagnostic
evidence, not a passing gate or a complete before/after measurement. No throughput
improvement is claimed. The frozen cleanup revision already documents gate
failures in `main:docs/qa/tests-cleanup.md`; additional timing failures differed
between hosts. Repository test and product source files were not changed.

Two focused CLI canaries each passed six tests, but both correctly selected free
remote slots. The final complete scheduler regression also passed after the
worktree-specific Vitest resolution change. The Mac was observed eligible at
08:12 and 09:03 CET; GPU work or unavailable remote/queue timing prevented a local
canary during those windows. Near cleanup it reported only 3.00 GiB free physical
RAM, below the 4 GiB threshold. Admission was never bypassed.

All owned checks were stopped or completed. The single 2.3 GB benchmark worktree
was removed, and all three hosts were checked for remaining processes with that
benchmark working directory. Completed receipts remain outside the removed tree.

To finish acceptance, schedule three remote hosts and an eligible Mac together,
then run both benchmark configurations against the same frozen revision/package.
The measured remote gate spans suggest allowing at least 70 minutes plus setup
for the eight-command comparison. A new coordinated time window is needed after
the task's three-hour limit. The broader native browser gate also remains unverified.
