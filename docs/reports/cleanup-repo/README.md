# Repository cleanup: batches A, B, C and H

Completed on `lane/cleanup-repo`, from base `ecbbd06bdf51e33a1c5cdf47e5d3f65b5a1ed19a`. [Verification and archive receipts](evidence.json) record the commands, results, original Git blobs and external manifest hashes.

| Measurement | Before | After |
| --- | ---: | ---: |
| Tracked files | 42,798 | 19,701 |
| Tracked bytes | 4,945,721,663 | 2,241,721,251 |
| Fresh worktree disk, KiB | 4,921,608 | 2,231,432 |
| `docs/reports/` files | 26,099 | 8,710 |
| `docs/reports/` bytes | 2,635,367,566 | 806,930,375 |
| Tracked `test-results/` files / bytes | 6,132 / 914,527,320 | 0 / 0 |

The duplicate texture stripper is removed; all 27 test imports use the tools implementation. The 422 pinned fixture files retain their original blobs. Generated receipts and per-lane timing JSON use ignored `test-results/`. Layout cache tests simulate source edits without writing tracked files.

The archive contains **23,105 files / 2,704,773,605 bytes**, including 1,526 identical linked assets (85,979,113 bytes) and three full matrix journals. Every moved file was checked with `git hash-object` before untracking and again in the final audit. Concise matrix indexes retain every scene result, proof link, frame count, duration and failure note. All original report Markdown remains represented at its existing path; historical conclusions are preserved. Missing historical link targets are labeled unavailable.

Typecheck, lint, remote `tests/unit tests/levels` (2777 passed, 0 failed, 9 pending), headless Metal WebGL2 smoke (10 passed), the tracked-tree link/retention check and post-test cleanliness checks passed. The passing native smoke used `E2E_PORT=4691 SCENE_PORT=4692`, one worker and headless Chromium. Test source trees are recorded at `afcbb9de3396b87c99ab9acaa6324726fb9359e9`. C-path handling lets the L3 capture tool prefer regenerated SVGs (with pinned-fixture fallback) and preserves incoming physical-device recordings under ignored results. Runtime code and the full unit/level test trees are unchanged from the verified remote run. Final report edits change documentation only.

The remote post-test guard compares every synced file's Git blob hash and mode, index entries and untracked paths against the pre-test baseline; the runner intentionally has no Git blob store. Its two preexisting untracked bookkeeping files (`.mi-manifest`, `.mi-nmhash`) remain unchanged as a list; the local post-test `git status --porcelain` is empty. A prior SwiftShader controls smoke timed out, and its browser run was stopped before WebGPU cases; those receipts are preserved under `test-results/cleanup-repo/remote-first/`. The required WebGL2 smoke passed on native Metal; WebGPU remains manual.

The guarded full run had one existing 300-second asset-validation timeout under runner contention; a shared-runner focused attempt also timed out. All 18 cases in that unchanged file passed in a focused single-worker run holding both runner slots, also with a clean before/after guard. Both timeout attempts and the passing isolated retry are retained. Raw run logs and timing receipts remain ignored under `test-results/cleanup-repo/` and `test-results/timings/`.

The [retention policy](../../process/evidence-retention.md) and CI reject oversized or unreferenced report files and tracked test receipts. The audit accounts for every original evidence file and confirms unchanged runtime code, assets, layouts, specs, QA and protected reference trees. External archive/manifests: `/Users/wesner/Workspace/mi-evidence-archive/cleanup-20261026/` (evidence retains its original path beneath the archive root). Archive moves pause below 6 GiB free space.

The before disk measurement used a detached fresh worktree, removed immediately. The after measurement hard-links the tracked files read-only into an empty detached worktree on the same volume, checks that it matches HEAD, runs `du -sk` for per-tree allocated blocks, and removes the temporary links. Each file shares one inode/data copy; protected source paths stay intact. Neither measurement includes dependencies or ignored outputs. Automatic repository maintenance was disabled after failed temporary Git packs filled the disk. Git history work is left to the following lane.
