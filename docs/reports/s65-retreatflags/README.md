# S65: L5 and L6 retreat-flag recovery

## Result

The level-design changes bring both requested levels within the threat-flag caps without changing zombie stats, speeds, armor, damage, or corpse persistence.

The exact focused audit completed with zero gameplay flags for both L5 and L6. It emitted only the expected diagnostic markers for selecting a subset of levels and for not matching the main-source hash. Both skilled routes completed.

| Measure | L5 | L6 |
|---|---:|---:|
| Retreat sample | 20.00 s | 20.00 s |
| Attack starts | 4 | 6 |
| Landed hits while moving | 3 | 4 |
| Landed hits/min | 9.00 | 12.00 |
| Gameplay flags | 0 | 0 |

L5-05 passed at 1076.96 passive attacks/min and 5.94 skilled attacks/min. L5 follower pace passed across seeds 1–3. L6-05 passed at 196.99 passive attacks/min with 100% passive reachability; both breach cohorts spawned in full, with first attacks at 2.07 s and 4.25 s.

## L5 cause bisect

The new landed-hit flag traces to S49 commit `500ad9df` (the butcher pair relocation), rather than to S54, S55, or S57.

With the current S49 coordinate `(11,28)`, the unadjusted L5 layout records 0 landed hits in the kite sample. A matched diagnostic restoring the pre-S49 coordinate `(14,28)` records 1 landed hit in 20 seconds, enough to meet the audit floor, but introduces stuck-chaser flags. The original placement therefore cannot be restored as the fix.

The S54 comparison used the original L5 layout and matched 100-infected start population on both sides. The pre-S54 `Damage.ts` and the current S54 poise implementation both recorded 0 landed hits. This rules S54 out. S55 is renderer work, and S57 changes rendering plus L8 boss arenas; neither changes L5 simulation.

The retained fix schedules one existing `infected.runner` for the search phase at `(-37,24)`, 38 seconds after mission start (tick 2280). One slot is reserved in the initial cohort and filled by that arrival, preserving the tier cap. This meets the opening encounter pressure while keeping the rescue-route follower metrics clean.

## L6 retreat design

The first members of breach waves one and two use existing runner and dog archetypes, respectively. The spawn candidates use the announced access mouths and off-screen offsets; both cohorts receive a 20-second approach window so they continue pressuring the retreating courier. No archetype stats were changed.

## Validation

- `node --import tsx/esm tools/qa/threat-audit.ts --levels L5,L6 --report test-results/s65-final-exact` — L5 0 gameplay flags; L6 0 gameplay flags; both kite samples and skilled routes pass.
- `npm run typecheck` — passed.
- `npm run lint` — passed.
- Local `npm test` — 107 passed, 27 files passed; 150/150 case budget; 104.4 s.
- Required remote `sh tools/remote/run.sh "$PWD" -- npm test` — passed on `94.130.181.173`: 106 passed, 1 skipped, 27 files; 150/150 case budget; 200.8 s within 240 s. The first attempt on `178.104.70.127` timed out at 241.0 s; the full suite was rerun unchanged.

## Browser QA needed

No browser was opened for this task. Please visually inspect:

- **L5:** at tick 2280 (38 s), check the search arrival around `(-37,24)` and confirm it appears on the west street outside Okafor's 22 m quiet pocket. Watch through tick 3480 (58 s) for the opening exchange, then follow the courier from Mia toward Okafor to check that the runner does not pull the rescue group off its route.
- **L6 breach one:** inspect the access mouths around `(-10,-18)` and `(10,-18)` from tick 1992 (33.2 s) through tick 4608 (76.8 s). Confirm all eight arrivals use the announced entrances and stay visually connected to the retreat.
- **L6 breach two:** inspect the second announcement at tick 3253 (54.22 s) and follow its ten arrivals through the tunnel. Check the side hatches at x `54, 126, 198` / z `11.2` and x `78, 162, 228` / z `18.8` for visible, non-popping approaches.

## Receipts

The final focused receipt is `test-results/s65-final-exact`. Historical comparisons are in `test-results/s65-pre-s49-candidate` and `test-results/s65-pre-s54-exact-baseline`.
