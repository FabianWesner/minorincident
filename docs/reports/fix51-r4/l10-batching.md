# L10 physical batches

The default acceptance worker stops after six minutes. The merged-head native route takes 1,173 / 1,175 seconds at low / high. Its six-minute browser aborts cannot qualify full-level console coverage.

The lane continued the actual production saves in separate headless batches, each with at most 480 seconds of active input and a reservation under ten minutes. The original input driver and its `noSkip` guard remain in use. At a batch boundary, the driver pauses, opens Settings, selects the same quality, and returns; this invokes the production live-save path. The next batch uses the normal level-list Resume action. No objective advancement or synthetic world state is used. Survival protection remains enabled.

Production Resume rebases the local tick counter. Progress is checked using cumulative mission time; the audit also checks that each batch uses the preceding actual saved snapshot. Successful chains must reach completed credits and `completedLevels >= 10`. Both qualities and renderers are checked from the runtime completion data.

## Evidence

- [Chain summary](l10-physical-summary.json) and [all batch outcomes](l10-batches.json).
- Initial budget aborts remain under `attempts/`; compressed batch metadata and completion snapshots are under `l10/`.
- Both low-tier chains completed. Both high-tier chains encountered separate route failures. Those attempts remain incomplete and receive no full-console qualification.
- The first batch helper is archived as [source text](l10-batch-v1.txt). Its successor checks cumulative mission time rather than requiring the rebased tick counter to increase. Receipts retain both source hashes; the audit verifies the recorded version for each batch.

## Replay

These are lane-specific reproducers for the recorded merged-head build, not a replacement for the general acceptance runner. Use the candidate preview on port 4901. A fresh default L10 run produces the initial actual saves; alternatively restore its archived `attempts/*-completion.json.gz` to the corresponding ignored `test-results/fix51-browser/*/accept-completion.json` path. Restore the matching initial receipt before republishing a replay.

Run one batch with `node --import tsx tools/qa/fix51-r4-l10-batch.mjs webgl2 low 1`, then successive indices until it completes or reports a real route failure. The controller runs at most two clients and supports an optional `FIX51_R4_BATCH_DEADLINE` ISO timestamp. The publisher archives the initial attempts and qualifies only completed chains.

The general `qa:accept` worker still needs this bounded Resume orchestration integrated before a fresh single-command L10 run can cover the entire level.
