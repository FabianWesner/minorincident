# Repository cleanup: batches A, B, C and H

Base: `ecbbd06bdf51e33a1c5cdf47e5d3f65b5a1ed19a`; branch: `lane/cleanup-repo`.

The duplicate texture stripper is removed. Tests use the tools implementation. Pinned build receipts, reviews and baseline inputs have moved to `tests/fixtures/`; generated receipts and lane timing summaries use ignored `test-results/`. Layout cache tests simulate edits through their read boundary instead of writing tracked source files.

The [retention policy](../../process/evidence-retention.md) keeps all report text and selected linked proof. Archive operations move each file on the same volume, compare `git hash-object --no-filters` with its original Git blob, then remove it from the index. The external archive and manifests are under `/Users/wesner/Workspace/mi-evidence-archive/`. Historical conclusions and QA/spec documents remain retained. Existing missing link targets are labeled unavailable; they are not claimed as archived evidence.

| Measurement | Before | After |
| --- | ---: | ---: |
| Tracked files | 42,798 | 19,700 |
| Tracked bytes | 4,945,721,663 | 2,241,676,299 |
| Fresh worktree disk, KiB | 4,921,608 | 2,231,384 |
| `docs/reports/` files / bytes | 26,099 / 2,635,367,566 | 8,709 / 806,885,423 |
| Tracked `test-results/` files / bytes | 6,132 / 914,527,320 | 0 / 0 |

The before measurement used a detached fresh worktree without dependencies or ignored outputs; it was removed immediately after measurement. Git history has not been rewritten. Archive moves pause below 6 GiB free space.

The after measurements above describe checkpoint `afcbb9de3`; final report metadata will be included in the final totals. Its temporary after worktree used read-only hard links on the same volume and was removed immediately, without duplicating evidence data.

The archive audit verified all 23,105 files / 2,704,773,605 bytes against Git blob hashes. It accounts for every original evidence file, verifies all 422 fixtures and confirms unchanged protected source trees. Typecheck, lint, headless native Metal WebGL2 smoke (10/10), retention/link checks and the full remote post-test integrity guard (18,849 files) passed. No test results remain tracked.

The latest full remote unit/level run passed 2,776 tests, skipped nine and hit one existing 300-second asset-validation timeout. A focused shared-runner retry hit the same timeout; both attempts left tracked files unchanged. An isolated retry of the unchanged file is waiting for both original-runner slots. Final gate status and self-inclusive measurements remain pending; this checkpoint does not claim completion.
