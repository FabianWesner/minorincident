# Evidence retention

Keep concise, reviewable evidence in Git. The [report index](../reports/README.md) links to every retained report. Keep `docs/qa/`, `docs/process/`, and report text referenced by specifications or QA documents.

- Retain every report's Markdown, plus images and JSON linked by retained Markdown. JSON must be **smaller than 300,000 bytes**; every report file must be **at most 1,000,000 bytes**. Retain the selected final proof rather than repeated captures.
- Move raw traces, frame sequences, logs, videos, large JSON, unlinked files and duplicate blobs to `/Users/wesner/Workspace/mi-evidence-archive/<original-repository-path>`. Archived links use that absolute path; the archive is local and is not part of a fresh checkout or CI.
- Before each report family, check `df`. Pause if available space is below **4 GiB**. Use a same-volume **move**, never a copy: compare the destination's `git hash-object --no-filters` result with the original tracked blob ID, then `git rm --cached` the source. If hashes differ, restore the move and stop. Keep a path/blob/byte manifest in the external archive. Never overwrite an existing archive file.
- Before moving anything, search `tools/`, `tests/`, `src/` and `package.json` for readers, including dynamic paths. Required fixture inputs live under `tests/fixtures/` and stay tracked. Update their consumers and report links together. Generated pipeline intermediates are recreated by their producing command; they are not pinned fixtures.
- Tests and gates write disposable receipts to ignored `test-results/` or temporary directories. Explicitly publishing a selected receipt is a separate action: link it from a report and pass this policy first. Never force-add `test-results/`. The `test:*` scripts record lane command, revision, host, dates, duration and exit status under `test-results/timings/`.
- Keep historical report conclusions unchanged. Repair relocated links. For a target already absent at cleanup time, preserve its name as text and label it unavailable; do not invent evidence or claim that a missing artifact was archived.

Run `python3 tools/qa/evidence-retention.py` before committing. CI checks all tracked report files for size, allowed type and Markdown references; it checks relative links in retained report Markdown and this policy against the tracked tree, and rejects tracked `test-results/` files. CI also requires a clean working tree after tests. Markdown code examples, external URLs, anchors and absolute local archive links are not relative repository links.

Cleanup measurements and verification are recorded in [the cleanup report](../reports/cleanup-repo/README.md). Existing Git history retains old blobs; these changes reduce fresh checkout size without rewriting history.
