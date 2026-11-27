# L6 acceptance fixes

## Results

| Row | Before: low / high | After: low / high | Cause and fix |
|---|---|---|---|
| L6-07 retreat damage | 0 / 0 HP | 30 / 30 HP | Recurring pairs were assigned to nearby survivors and could stay behind closed gates. Select a reachable service mouth near the courier, target the first member of early pairs at the courier, and keep arrivals on the track. Counts and 14 s cadence remain unchanged. Acceptance attack rate was 10.63 combined windups/min; threat audit measured 4.41 player attacks/min, 5.30 follower attacks/min, and first attack at 0.07 s. Concurrent infected: 21. |
| L6-10 markers | 12 / 12 gate branches failed | 0 / 12 branches failed; 0 trajectory offenders | The retreat ring stayed on the platform even when the next gate was the active destination. The ring now uses that gate's fixed wait point until the gate is passed, then returns to the fixed platform anchor. |
| L6-13 fists only | 900 s, incomplete, 50 deaths / 900 s, incomplete, 50 deaths | 248.9 s, complete, 5 deaths / 248.9 s, complete, 5 deaths | The route had no retry checkpoint between the shelter and the first gate, so deaths repeatedly replayed the retreat opening. Add a fixed checkpoint at x=60. Preserve a deliberately unarmed L6 campaign loadout instead of restoring the authored weapons at the level boundary. Both tiers offered fists/kick and used fists only. |

The targeted acceptance checks pass on both tiers. The full L6 report still has unrelated `NOT CHECKED` clauses because this run skipped browser review; the runner reported zero fresh failing rows on high and low.

## Open

`node --import tsx/esm tools/qa/threat-audit.ts --levels L6` still reports two passive exit pacing flags: `step/exit:SLOW_FOLLOWER:16` and `phase/exit:SLOW_FOLLOWER:16`. The passive sample has the corgi (entity 15) at 3.40 m/s and Marcus (entity 16) at 2.20 m/s; native level initialization confirms those identities. `PARTIAL_LEVEL_SELECTION` is expected for a one-level audit. The required zero-flag threat audit is not yet met; the exit pacing discrepancy needs a game-side fix.

## Changed files

- `src/sim/missions/LevelSixSubway.ts` — pressure routing, gate/platform marker anchor, and retreat retry checkpoint.
- `src/sim/missions/types.ts` and `src/data/l6.ts` — checkpoint state and authored checkpoint.
- `src/sim/progression/apply.ts` — preserve deliberately unarmed L6 racks.
- Fresh tier receipts: `docs/reports/fix51-verify/receipts/L6-{high,low}-{complete,fixtures,checkpoints,stationary}.json` and `docs/reports/fix51-verify/L6.json`.

## Validation

- `npm run qa:accept -- --level L6 --skip-browser --tier high` — 0 fresh failing rows; 14 incomplete rows.
- `npm run qa:accept -- --level L6 --skip-browser --tier low` — 0 fresh failing rows; 12 incomplete rows.
- `npm run typecheck` — pass.
- `npm run lint` — pass.
- Focused `missions.test.ts` and `save-progression.test.ts` — 12/12 pass.
- Threat audit — incomplete: two passive exit pacing flags listed above.
