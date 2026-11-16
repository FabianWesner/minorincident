# s145 — playtest driver recovery

Candidate game source: `69562fd1` (batch 113). Only playtest tooling, its existing tests, and this report changed. No deployment, push, main movement, game tuning or corpse changes.

## Acceptance evidence

| Trial | Result | Duration | Navigation flags |
| --- | --- | ---: | ---: |
| L9 HIGH road 1 | L10 handover, no skips | 307 s | 0 |
| L9 HIGH road 2 | L10 handover, no skips | 303 s | 0 |
| L9 HIGH road 3 | L10 handover, no skips | 271 s | 0 |
| L9 LOW road | L10 handover, no skips | 246 s | 0 |
| L9 HIGH dry-shortcut | L10 handover, no skips | 208 s | 0 |
| L10 HIGH mortal journey 1 | Actual credits finished; campaign completedLevels=10 | 3 segments | L10 warnings retained |
| L10 HIGH mortal journey 2 | Actual credits finished through production Continue | See recovery below | L10 warnings retained |

Both L10 completion snapshots report HIGH, phase `progression`, `credits-finished=true`, completedLevels=10, and finished runs without skips. No immortal or survival-protection flags were used. Raw runs: `test-results/s145-driver/l10-high-rifle-7-full` and `l10-high-rifle-8-full`; final snapshots are `campaign-3-completion.json` and `campaign-5-completion.json` respectively.

Both final journeys recorded **zero deaths before first observed farmhouse hunting-rifle pickup** (ticks 3025 and 3093). This is the explicit farm-entry exploration boundary used for the comparison. Archived batch-108 `l10-video` and `l10-seed2-video` record 13 and 18 deaths, with their README attributing the repeated deaths to the farm entrance. Zero is below half of either archived count. These historical samples used HIGH zoom 1 and one seed-2 repeat; the present runs began HIGH zoom 1.5. Whole-route observed deaths were five and ten respectively, including later regions; these totals are not substituted for entrance counts.

Journey 2 initially timed out selecting hidden pause Settings at a sample boundary during credits. Its retained production profile resumed the ending through normal Continue. A requested-zoom-1.5 retry failed an assertion because the ending camera target was 1; the zoom-1 continuation completed credits in 100 seconds with zero issues. The driver now defers sample yielding while the L10 ending is active. This history is retained rather than presented as an uninterrupted run.

## Changes and validation

- L9 follows the live bridge objective after evacuation. Stationary and repeated-approach recovery use physical reverse/steer, then re-approach the same target.
- L10 seeks the farmhouse rifle via a logged map detour, selects recovered rifles/nail guns, seeks visible uncollected medkits when hurt, and keeps combat travel on the player route. Nearby screen projections prevent a distant nav target reversing the input bearing.
- Extended carried weapons use actual HUD mouse clicks; numeric shortcut 10 uses Digit0. No synthetic Digit19 input remains.
- Empty opening HUD objectives reset the stall clock. Existing unit coverage checks empty HUD through objective appearance.
- An eight minute mortal sample ended with P3 `sample-cap`, zero P0 and no objective skip. Actual no-progress failures retain their separate labels.
- Bounded L10 sessions save live Resume through pause/settings and continue through the normal menu, within one headless browser reservation at a time. Ports 5027/5028; no shared port 3300.

Final typecheck and lint pass. Prescribed `sh tools/remote/run.sh "$PWD" -- npm test` passes on 46.225.66.90: 27 files, 105 passed / one existing skip, 185.6 seconds within 240 seconds. Inventory remains 150/150; assertions were extended inside existing tests. QA build passed; game source stayed at the candidate revision.

## s146 warning correction

The old unchanged-HP timer could warn without any resolved attack. It now logs `unchangedHpDiagnostic` with unique resolved melee attack IDs, committed melee-query target IDs, hit IDs and damage amounts. A warning requires at least eight recent resolved queries including the named target, with no positive target damage. Mere observation time, misses and unsupported ranged evidence do not qualify. Regression assertions cover nine seconds with zero attacks, resolved misses, accepted target queries and positive damage rejection. This does not establish attribution for historical product-hit reports.

## Review and limitations

Opened and reviewed [contact-sheet.jpg](contact-sheet.jpg), current diagnostic ticks 13536 and 14685: low-health axe courier beside farm buildings and close contacts. The sheet predates the final rifle/route fixes and is labeled diagnostic, not final visual acceptance.

L10 still emits navigation/hangar and occasional combat diagnostics while making progress. The requested zero-`stuck-navigating` criterion is met by the complete L9 matrix; no universal L10 warning-free claim is made. The first full L10 journey retained five P2 observations including a frame hitch. Earlier failed attempts, the save-boundary error, and the attack-observer verification scope remain in [qa.json](qa.json), under 200 KB. The initial remote-runner/sandbox errors were infrastructure failures, not gameplay evidence.
