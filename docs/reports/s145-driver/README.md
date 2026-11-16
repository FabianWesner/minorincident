# s145 playtest driver — partial implementation, acceptance pending

Candidate: `69562fd1` (batch 113). This lane changes only `tools/playtest/**`, its existing unit test file, and this report.

## Driver changes

- L9 bridge steering continues to target the live bridge marker. A route recovery now detects repeated vehicle positions within an eight second window when the vehicle has not improved its best distance to the goal, then applies physical reverse plus alternating steering and re-approaches the same goal.
- L10 travel combat retreats from nearby threats when health falls below 65% and two or more threats are within 6 m. If a visible, uncollected medkit is within 22 m, it steers toward that pickup while keeping ordinary mouse fire aimed at a visible threat.
- Empty objective text resets the visible-progress clock, so level-opening frames without an objective do not emit navigation stalls.
- Reaching the configured per-level deadline emits a P3 `sample-cap` issue and exits without emitting `cannot-finish` P0 or skipping the objective.

## Verification

`npm run build:qa`, `npm run typecheck`, `npm run lint`, and `npm test` pass. The full local test run reported 27 files and 106 tests; the repository preflight counted 150 cases, within its 150-case limit. The required remote wrapper could not run because no healthy remote runner was provisioned. The equivalent local `npm test` passed.

The first new loop assertion failed because it required nine observations despite using an eight second elapsed-time window. The detector was corrected to compare any retained sample at least eight seconds old; the full suite then passed.

Current-worktree real-input acceptance is **not verified**. `npm run playtest` rebuilt successfully, then the `tsx` CLI failed creating an IPC socket (`EPERM`). Running the same driver with `node --import tsx/esm` avoided that issue, but its preview server could not listen on unique port 5027. No browser run started, so this report does not claim L9 reach-L10 or L10 death-rate improvement.

## Archived evidence reviewed

The archived batch-112 report records HIGH road 1, HIGH road 2, HIGH shortcut and LOW road L9 runs reaching L10 with no skips; this is baseline evidence only. Its LOW bridge warnings at ticks 15571 and 15765 motivated this change. I opened the archived LOW capture at tick 15571 and reviewed it as a single-frame diagnostic; the APC is near the bridge marker amid boarders, and the HUD reads 14 m. See [review-sheet.csv](review-sheet.csv) for the compact source mapping. These archived results do not validate this patch.

## Still required

- Run L9 HIGH road ×3, LOW road ×1, and shortcut ×1; all must reach L10 with no `stuck-navigating` flags.
- Run L10 HIGH ×2 to completion with mortal input, and compare deaths before farm interior against archived runs.
- Review a current-worktree contact sheet and update the run JSON with those results.

The run inventory, verification states and infrastructure errors are in [qa.json](qa.json) (<200 KB).

## Resumed validation

With unrestricted execution, the required remote unit suite passed on 46.225.66.90 (27 files, 105 passed / one skipped, 175.4 seconds). The first current HIGH road run completed L9 and its handover in 307 seconds with zero issues and no skips (`test-results/s145-driver/l9-road-high-1-live`). The remaining four L9 runs and two full mortal L10 runs remain pending. Earlier infrastructure blockers are resolved.

Second HIGH road run completed handover in 303 seconds with no skips or `stuck-navigating` flags. Two `enemy-frozen` observations were retained at ticks 4359 and 14385; these are outside the navigation acceptance criterion. Raw evidence: `test-results/s145-driver/l9-road-high-2-live`. Three L9 matrix runs and both full L10 runs remain pending.

Third HIGH road run completed handover in 271 seconds with no skips or `stuck-navigating` flags. One `enemy-frozen` observation was retained at tick 13548. HIGH road ×3 now passes the requested navigation criterion (307 / 303 / 271 seconds). LOW road, shortcut and both full L10 runs remain pending. Raw evidence: `test-results/s145-driver/l9-road-high-3-live`.

LOW road completed handover in 246 seconds with zero issues and no skips. This passes the required LOW navigation criterion. Raw evidence: `test-results/s145-driver/l9-road-low-live`. Shortcut and both full mortal L10 runs remain pending.

HIGH dry-shortcut completed handover in 208 seconds with zero issues and no skips. The full required L9 matrix now passes: HIGH road ×3, LOW road ×1, HIGH shortcut ×1, all without `stuck-navigating`. Raw evidence: `test-results/s145-driver/l9-shortcut-high-live`. Both full mortal L10 runs and the farm death comparison remain pending.

First mortal HIGH L10 attempt remains a failed diagnostic, deliberately stopped after repeated farm navigation warnings (ticks 10335 and 23244). It advanced to `cure-pace-3`, near x986, with six observed deaths. Retreat triggered, but did not reliably prevent farm navigation stalls. This is not a full-run acceptance result; both required full L10 runs and the baseline comparison remain open. Raw evidence: `test-results/s145-driver/l10-high-mortal-1`.

L10 follow-up: reuse the existing visible/uncollected health-kit observations, seek a kit below 65% HP when no contact is within 3 m, and approach nearby visible unowned guns during travel when no contact is within 2 m. This addresses missed pickup opportunities in the axe-only diagnostic. Typecheck and lint pass; the unchanged remote unit suite passes (27 files, 105 passed / one skipped, 183.9 seconds). Gameplay acceptance for this revision remains pending.

Segmented L10 continuation fix: the campaign CLI now enables the existing `saveOnYield` UI flow for bounded single-level L10 sessions, so the live production Resume snapshot is saved before releasing the browser reservation. Typecheck, lint and the required remote suite pass (27 files, 105 passed / one skipped, 179.6 seconds). Runtime save-boundary verification and full L10 acceptance remain pending.

Revised mortal HIGH L10 attempt (`l10-high-mortal-2`) was stopped for route diagnosis after a navigation warning at tick 14685 near x881. Final observation reached `cure-pace-3`, x934.6/z−42.575, 46.7 HP, still carrying the axe, with five deaths observed. Nearby gun seeking did not yet establish successful reacquisition. Neither full-run completion nor live save-boundary behavior was verified. The two required successful full runs and archived death comparison remain open.
