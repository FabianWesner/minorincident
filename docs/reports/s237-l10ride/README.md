# s237 · L10 finale ride loop

## Current result

Both latest HIGH and LOW skilled native routes completed, with all four roadblock sequences observed: mounted arrival, E dismount, on-foot fight, opened gate, E remount and crossing. HIGH took 446.9 seconds from the finale start to the gate. LOW took 551.5 seconds, 11.5 seconds above the 540 second cap. The route therefore meets the loop count on both tiers and the time window on HIGH only.

Story radio cues were spaced at 45 seconds in HIGH. LOW had a 189.8 second gap after its sixth cue and did not deliver the tenth cue. The interval rule is not satisfied on LOW. See the complete native observer receipt in [route-final.json](route-final.json), including deaths, transitions and moment cadence.

| Tier | Outcome | Total route | Deaths | Hangar → gate | Roadblock loops | Story beat marks |
|---|---:|---:|---:|---:|---|---|
| HIGH | Complete | 1520.6 s | 10 | 446.9 s | 4/4 | 0, 45, 90, 135, 180, 225, 270, 318.5, 363.5, 408.5 s |
| LOW | Complete | 1539.1 s | 16 | 551.5 s | 4/4 | 0, 45, 95.2, 140.2, 185.2, 230.2, 420.0, 465.0, 510.0, not observed |

Loop phase ticks are in the JSON receipt. Deaths preserve the encounter ledger, so the observer now retains loop progress across checkpoint restores, matching the game state. The run still requires a new mounted approach for the next barrier and records its final remount and crossing.

## Set-piece visibility

HIGH then LOW were captured with the native game camera at zoom 1 using the dev server and headless browser pool. The capture is a teleported staging fixture, not a route replay. On both tiers the quarantine sign and figures are visible, though its upper text is clipped; the billboard is only partly in frame. The underpass reads as a dark empty road with its structure mostly outside the frame. The hospital frame shows road and a lamp, with no readable tents. These captures demonstrate the visibility work remains open. Reviewed sheets: [HIGH](captures/high/setpieces.jpg), [LOW](captures/low/setpieces.jpg).

## Validation

- `npm run typecheck` — pass on final source state.
- `npm run lint` — pass on final source state.
- Targeted regression tests for L10 camera framing and save progression — 9/9 pass after fixing the story cadence and underpass wall restore regressions.
- Full local `npm test` — pass, 105/105 tests across 27 files (the suite budget remains 148/150).
- `npm run qa:threat` — final all-level run exceeded its 600s browser reservation and exited 124. The previous completed audit reported one L10 LOW passive flag, `UNOBSERVED_PASSIVE_CRITERION_STEP:hold`; its no-attack route stopped at the first combat roadblock. Zero flags are not verified.
- Required remote `sh tools/remote/run.sh "$PWD" -- npm test` — pass: 104 passed, 1 skipped, 27 files, 220.3 s.
- No test cases were added. The configured suite remains 148/150 cases (127 Vitest, 9 E2E, 12 browser invariants across 45 files).

## Open

1. Reduce the LOW hangar-to-gate time by at least 11.5 seconds without increasing retries, and keep its story cadence within 45–75 seconds.
2. Make the underpass and hospital readable and recapture all four set pieces on HIGH and LOW during native route variations.
3. Reconcile the L10 passive threat audit with the required combat-gated roadblocks, then obtain a zero-flag all-level receipt.
4. Re-run the full threat audit within the reservation limit after resolving its L10 passive coverage path.
