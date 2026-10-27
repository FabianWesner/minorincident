# Lane infrastructure — 2026-10-27

Main integration and build-mode cache verification: [merge report](merge-main.md).

Implemented and committed on `lane/lane-infra`. Production code was verified through `d5a2e7764`; worktree timing uses `e89ba8941`, concurrency uses `b5d3e8285`. No test fixtures or `tools/remote/*` changed in this lane. No deployment.

## Operation

Browser commands now start/use the pool by default through `tools/e2e-lock.sh`, Playwright configuration, Scene Lab and capture clients. Legacy launch requires `E2E_LEGACY=1`; unavailable/disappearing pools fail clearly. Opaque commands reserve exclusive admission before launching their own browser. The daemon runs from a stable shared snapshot, so removing its initiating worktree cannot break subsequent launches.

Commands have a maximum 600-second reservation, including five seconds reserved for owned-process cleanup; shorter limits are supported. Errors tell callers to split longer batches. FIFO admission preserves shared requests queued before an exclusive barrier. Safety remains one GPU Chrome, at most two SwiftShader contexts, at most two Playwright workers, headless automation, and exclusive quiet-run for performance measurements. Idle context/browser release and adaptive admission remain enabled.

- `sh tools/browser-status.sh`: holders, startup/context/exclusive waiters and elapsed times.
- `sh tools/browser-busy.sh`: exit 0 for an active GPU reservation, including legacy compatibility locks; the mac-runner lane consumes this interface.
- `node tools/qa/wait-report.mjs`: per lane, UTC hour and resource count/mean/p95/max from `$TMPDIR/mi-waits.jsonl`; accepts both browser/sim and mac-runner's remote schema.
- [Shared worktree setup instructions](../../tools/worktree-setup.md): install the common Git hook with `sh tools/install-worktree-hook.sh`; custom creators call `sh tools/worktree-setup.sh <path>` directly.

The installed additive `post-checkout` hook covers both scheduler `--worktree` and Agent `.claude/worktrees` creation through `git worktree add`. Dependencies are lockfile-keyed writable APFS clones, with portable copy fallback. Vite/Vitest and the local `ndarray-pixels` package resolve inside each worktree without manual symlinks. Dist is reused for matching clean sources, build provenance, lockfile, arguments and Vite environment. Its store is bounded to three recent entries; pruning skips entries in use. Mutable Vite optimizer files include absolute paths/root hashes, so they are centrally stored but partitioned by worktree root rather than shared unsafely between roots.

## Fresh-worktree measurements

One sequential cold/warm pair, same revision, native Metal pool, private ports. Before: hook disabled, fresh `npm ci`, uncached build. After: actual scheduler `prepare_worktree` plus the installed hook and warm dist store. Both ran `npm run test:smoke`: **6 unit smoke tests and 34 browser smoke tests passed**, including the five Chromium desktop/phone projects. Every proof worktree was removed after evidence collection; at most one existed at a time.

| Measurement | Before | After |
| --- | ---: | ---: |
| Checkout + dependency setup | 17.53 s | 14.29 s |
| Production build | 8.95 s | 1.31 s |
| First green full smoke, including setup/build | 318.36 s | 288.61 s |
| Worktree `du` after smoke | 2.717 GiB | 2.736 GiB |
| Disk reclaimed by deleting the proof worktree | 2.749 GiB | 2.149 GiB |

Observed reclaim difference: **614 MiB (about 22%)**; first green was **29.75 s earlier**. `du` counts shared APFS extents and therefore does not show the physical saving. Reclaim uses host free-space changes across deletion; other lanes were active, so this is an observed shared-host estimate, not exact APFS extent accounting. The ~2 GiB checked-out assets remain per worktree. Runtime variation also contributes to the single cold/warm smoke comparison. [Raw measurement numbers and package resolution](worktree-measurements.json), [full smoke receipts](smoke.json).

## Concurrent lanes and waits

Two lanes (current checkout and a fresh hooked worktree), each running foundation smoke and Scene Lab concurrently. Smoke used one worker and repeated the two foundation tests three times; Scene Lab ran unchanged `courier-turns`, 540 frames, WebGL2/high, 800×600. Private ports were 4361–4364, with no use of 3300. All four commands passed:

| Lane | Smoke | Scene Lab | Browser admission mean / max |
| --- | ---: | ---: | ---: |
| A | 6 passed, 19.90 s | pass, 17.00 s command | 488 / 1818 ms |
| B | 6 passed, 21.42 s | pass, 17.25 s command | 616 / 1861 ms |

There were 34 logged acquisitions/connections. Maximum context wait was **1.861 s**, maximum handshake wait **7 ms**; all four commands completed within **21.5 s**. Status samples every 250 ms observed at most **one GPU root and four active contexts**, including a foreign lane already using the pool. The proof also mutated/restored a local cloned Vite package and confirmed that shared-store bytes were unchanged. [Concurrency receipts and sampled peak](concurrency.json), [raw waits](waits.jsonl), [per-hour wait report](wait-report.tsv), [reviewed Scene Lab contact sheet](courier-turns.jpg).

The [whole-host report](wait-report-all.tsv) includes sim acquisitions and mac-runner remote waits; remote waits of up to 720 s are visible and remain the mac-runner lane's responsibility. This change does not claim to eliminate those waits.

## Checks and limits

- `npm run typecheck` and `npm run lint`: passed after final code changes.
- `E2E_LOCK=/private/tmp/mi-infra-protocol.lock node --import tsx tools/browser-pool/check.ts`: passed isolation, capacity, FIFO across exclusive barriers, idle release, reconnect/native restart, opaque exclusive commands, profile portability and explicit legacy fallback. [Receipt](protocol-check.txt).
- [Reservation checks](cap-checks.json): shortened reservation exits 124 with split-batch guidance and cleanup; 601 seconds and wrapped three-worker commands are rejected with exit 2; direct three-worker CLI invocations are also rejected; `BROWSER_POOL=off` alone cannot select legacy. The shortened probe has a one-second execution allowance plus five seconds for cleanup; the default uses 595 + 5 seconds.
- [Cache pruning check](cache-prune-check.json): current/locked entries preserved, old unlocked entries removed, eventual three-entry bound. Writable dependency clones and a real warm build were exercised in fresh worktrees.

An initial concurrent `bench-sitter` attempt passed both smoke commands but failed the unchanged authored clipping gate in both scene commands (`clipping 1 > 0`). [Failure receipts](bench-sitter-failure.json) are retained; the concurrency proof uses `courier-turns`, and no gate was relaxed. An earlier full SwiftShader smoke attempt exceeded the old 60-second test timeout; the software-backend timeout is now 180 seconds. Full acceptance smoke was rerun on native Metal. SwiftShader lifecycle/capacity checks passed, but a full software smoke battery and manual WebGPU device acceptance are not claimed.

Detailed ignored logs remain under `test-results/lane-infra/`; the compact evidence linked here is committed. All proof worktrees have been deleted, and no validation command owned by this lane is left running.
