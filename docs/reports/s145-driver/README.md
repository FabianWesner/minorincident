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

The archived batch-112 report records HIGH road 1, HIGH road 2, HIGH shortcut and LOW road L9 runs reaching L10 with no skips; this is baseline evidence only. Its LOW bridge warnings at ticks 15571 and 15765 motivated this change. I opened the archived LOW capture at tick 15571 and reviewed it as a single-frame diagnostic; the APC is near the bridge marker amid boarders, and the HUD reads 14 m. See [contact-sheet.jpg](contact-sheet.jpg) for current farm diagnostic frames. These archived results do not validate this patch.

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

Reviewed the current two-frame contact sheet (ticks 13536 and 14685): axe-only courier beside farm buildings, low health and close contacts. L10 travel melee now backs away while mouse-attacking any contact within 2.6 m, before the low-health/crowd threshold. Typecheck, lint and remote suite pass (27 files, 105 passed / one skipped, 185.0 seconds). The effect on mortality remains unverified.

Eight minute mortal HIGH sample with earlier axe retreat ended naturally at 480 seconds with P3 `sample-cap`, zero P0, no skips, and 10 observed deaths. Cap labeling is runtime verified. Farm traversal still fails: navigation warnings at ticks 15775 and 28050, final x925.6/z84.5 on farmstead. This sample is not a full-run acceptance. Raw evidence: `test-results/s145-driver/l10-high-mortal-3-cap`.

Route-aware L10 travel movement now follows the existing player nav route toward the live objective while attacking pursuers, rather than fleeing indefinitely opposite one contact into corn rows. The latest sample showed drift to z84.5 with ten deaths; this motivates the change, not a success claim. Typecheck, lint and required remote suite pass (27 files, 105 passed / one skipped, 181.8 seconds). Gameplay acceptance remains pending.

Full-budget mortal HIGH attempt 4 ended naturally with exit 1 after four 480-second segments (configured overall 30-minute budget is checked between segments). It reached restricted-zone / `cure-pace-8`, then repeated deaths near x1916–1943 without finishing. Save/resume was verified across the segment boundaries through logged production Resume saves and continued checkpoint progress. Eight P2 observations, zero P0, no skips; full L10 acceptance is not met. Segment death counts and saves are retained in qa.json. Raw evidence: `test-results/s145-driver/l10-high-mortal-4-full`.

Axe-only diagnosis: the carried-weapon preference list omitted hunting rifle, assault rifle and nail gun, and direct objective travel passed the farmhouse rifle detour. The driver now selects these carried guns and uses a logged physical-input map detour to the nearby authored farmhouse rifle when still without a firearm. Existing unit coverage now checks each gun plus empty fallback. Typecheck, lint and remote suite pass (27 files, 105 passed / one skipped, 181.8 seconds; 150-case budget retained). Pickup and survival improvement remain runtime unverified.

Rifle detour runtime trial 5 confirmed hunting-rifle pickup with one death observed before the x891.13/z−9.38, 100 HP rifle sample. It then stopped on driver error `Unknown key: Digit19`. Fixed carried selection to use digits 1–9, Digit0 for 10, and physical HUD button clicks for higher catalog indices. Typecheck, lint and remote suite pass (27 files, 105 passed / one skipped, 189.6 seconds). Full L10 acceptance remains unverified. Raw evidence: `test-results/s145-driver/l10-high-rifle-5`.

Rifle trial 6 confirmed collection and continued play beyond the prior Digit19 crash, but was stopped after repeated off-road loops near x1865/z−145…−210. Inspection found ranged covering movement projected a potentially distant nav point directly through the camera; it now projects a point at most 3 m along the same bearing, matching existing nearby-projection recovery. Typecheck, lint and remote suite pass (27 files, 105 passed / one skipped, 179.4 seconds). Runtime effect and full L10 acceptance remain open. Raw evidence: `test-results/s145-driver/l10-high-rifle-6-full`.

## First full mortal L10 PASS

Projection-fixed attempt 7 completed real credits with no skips and immortal=false. Three segments lasted 481 / 480 / 430 seconds; observed deaths were 2 / 2 / 1 (five total). Five P2 observations (navigation/hangar warnings and a 1300 ms hitch), zero P0/P1/P3. Rifle pickup and the extended selection path remained functional; the restricted-zone and hangar warnings recovered. Raw evidence: `test-results/s145-driver/l10-high-rifle-7-full`. This establishes one full completion, not the required two or the archived before-farm-interior death ratio. Those requirements remain open.

## Time-box status and s146 follow-up

The second final mortal run reached the dispersal hold but failed at a bounded-session save: `pause-settings` remained hidden and the click timed out. Full completion is unproven. One full mortal completion is verified; the required two are **not met**. Fixing save/yield during the ending and repeating the second run remain open.

Located the archived 13/18 entrance-death baseline in `docs/reports/batch-108-real-input/qa.json` (`l10-video`, `l10-seed2-video`) and its README attribution to farm-entrance fighting. Both final current runs have zero observed deaths before first observed hunting-rifle pickup (ticks 3025 / 3093); the first completed run has five deaths across the whole level, below half even the lower archived count. The pickup boundary is reported explicitly; this does not replace the missing second full completion.

Per orchestrator s146: unchanged-HP observation time no longer suffices for `enemy-unhittable`. A read-only resolved-melee observer records unique attack IDs, committed query target IDs, hit IDs, and damage events. A warning needs at least eight recent resolved queries qualifying the named target and no positive target damage. Ranged/unqualified observations remain diagnostic. Existing unit tests cover nine seconds with zero attacks, resolved misses, qualified attacks, and positive damage rejection. Typecheck, lint and prescribed remote suite pass (27 files, 105 passed / one skipped, 188.2 seconds; inventory 150). Runtime qualification of this observer remains open. No main movement, deployment or push.
