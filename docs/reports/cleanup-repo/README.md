# Repository cleanup: batches A, B, C and H

Base: `ecbbd06bdf51e33a1c5cdf47e5d3f65b5a1ed19a`; branch: `lane/cleanup-repo`.

The duplicate texture stripper is removed. Tests use the tools implementation. Pinned build receipts, reviews and baseline inputs have moved to `tests/fixtures/`; generated receipts and lane timing summaries use ignored `test-results/`. Layout cache tests simulate edits through their read boundary instead of writing tracked source files.

The [retention policy](../../process/evidence-retention.md) keeps all report text and selected linked proof. Archive operations move each file on the same volume, compare `git hash-object --no-filters` with its original Git blob, then remove it from the index. The external archive and manifests are under `/Users/wesner/Workspace/mi-evidence-archive/`. Historical conclusions and QA/spec documents remain retained. Existing missing link targets are labeled unavailable; they are not claimed as archived evidence.

| Measurement | Before | After |
| --- | ---: | ---: |
| Tracked files | 42,798 | Pending final audit |
| Tracked bytes | 4,945,721,663 | Pending final audit |
| Fresh worktree disk, KiB | 4,921,608 | Pending final audit |
| `docs/reports/` files / bytes | 26,099 / 2,635,367,566 | Pending final audit |
| Tracked `test-results/` files / bytes | 6,132 / 914,527,320 | 0 / 0 |

The before measurement used a detached fresh worktree without dependencies or ignored outputs; it was removed immediately after measurement. Git history has not been rewritten. Archive moves pause below 6 GiB free space.

Verification and the final archive inventory are pending. The archive pass paused at the requested disk threshold; no completion is claimed by this checkpoint.
