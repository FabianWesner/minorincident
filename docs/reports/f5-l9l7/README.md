# f5-l9l7 — L9 and L7 acceptance fixes

## Results

| Row | Tier | Before | After | Result / evidence |
|---|---|---:|---:|---|
| L9-04 | Low | Scripted leaper landing billed 20; six 20-HP landings in the cited baseline | 31 attack transactions, every one 10 HP; all other contact transactions match the PO table | PASS — [low receipt](../fix51-verify/receipts/L9-low-complete.json) |
| L9-04 | High | Scripted leaper landing billed 20; six 20-HP landings in the cited baseline | 6 attack transactions, every one 10 HP; all other contact transactions match the PO table | PASS — [high receipt](../fix51-verify/receipts/L9-high-complete.json) |
| L9-16 | Low | No `l9.mega-boarded` signal; Mega hidden during approach/fall | Mega boarding 10242 < collapse 10272 < impact 10362 | Numeric PASS — [low receipt](../fix51-verify/receipts/L9-low-complete.json) |
| L9-16 | High | No `l9.mega-boarded` signal; Mega hidden during approach/fall | Mega boarding 10219 < collapse 10249 < impact 10339 | Numeric PASS — [high receipt](../fix51-verify/receipts/L9-high-complete.json) |
| L9-17 | Low | Axe-only rack correct, but checker waited for retired `crawl-finished` | Weapons lost 10272 < `l9.rise` 10602; exact rack `[weapon.fire-axe]` | Numeric PASS — [low receipt](../fix51-verify/receipts/L9-low-complete.json) |
| L9-17 | High | Axe-only rack correct, but checker waited for retired `crawl-finished` | Weapons lost 10249 < `l9.rise` 10579; exact rack `[weapon.fire-axe]` | Numeric PASS — [high receipt](../fix51-verify/receipts/L9-high-complete.json) |
| L7-04 | Low | 22 Alphas | 14 Alphas (11 later admissions + 3 opening residents); 389 regular admissions; peak 97 | PASS — [low receipt](../fix51-verify/receipts/L7-low-complete.json) |
| L7-04 | High | 22 Alphas | 14 Alphas (11 later admissions + 3 opening residents); 962 regular admissions; peak 189 | PASS — [high receipt](../fix51-verify/receipts/L7-high-complete.json) |

## Causes and changes

- **L9-04:** both the scripted leaper landing and its later attached strikes used 20 durability points. They are attack transactions under the PO table; both now bill 10. The fresh low/high receipts contain no 20-point attack transaction.
- **L9-16:** the 2026-11-22 ending rework removed the crawl and hid the Mega until after impact, though the PO complaint concerned only the ending. The Mega now lands visibly on the APC 60 ticks into the crash approach, rides visibly through the fall, and still climbs out of the wreck in the existing ending. Fresh signal order is shown above.
- The bridge render now has four independently animated spans over the actual gully, beginning at the fall signal and dropping at 14-tick intervals.
- **L9-17 checker exception:** this is the only evaluator change. The current game has no `l9.crawl-finished`; its clearance-equivalent event is `l9.rise` after the PO 2026-11-22 removal of the crawl. The axe-only rack and loss timing were already correct. The fresh native ledger proves the retired signal is absent and the replacement signal follows `l9.weapons-lost`.
- **L7-04:** the 22 count was 3 opening residents plus 19 later spawn calls. The 19 included eight repeated admissions after the rocket-checkpoint retry: pack 702 (2), 703 (1), 704 (2), and final pack 700 (3). The game restored the encounter request ledger and then admitted those already-arrived Alpha slots again. L7 now carries those Alpha actors and their arrival ledger through checkpoint retries; an incomplete queued slot is still requested on retry. The post-fix identity ledger contains 11 later Alpha admissions, with no replayed identity, plus the 3 opening residents = 14 on both tiers.

  The reproduced [high baseline birth ledger](L7-high-before-births.json) records tick, entity ID, pack, type and position for every later birth. Pack 702 repeats tick 689 at 2869 (2 births); 703 repeats 1581 at 3823 (1); 704 repeats 1914 at 4157 (2); and 700 repeats 2057 at 4274 (3). Each repeat has the same pack, type and authored position as its first admission. The checkpoint restores the entity allocator, so some IDs are reused: these are distinct spawn calls, not duplicate observation of one call. Packs 712–714 contribute the remaining three later births. The [fixed high receipt](../fix51-verify/receipts/L7-high-complete.json) retains the corresponding per-birth ledger and contains only the first eight plus those three trailing births.

## Validation

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- Focused `missions.test.ts` and `waves.test.ts` run: the mission suite passed; waves suite had existing unrelated follower-pace failures in high and low and an L4 alarm low failure. These remain open.
- Fresh `npm run qa:accept -- --level L9 --skip-browser --tier high|low`: zero fresh failing rows on both tiers. All L9-04/16/17 native checks pass. The low bridge checkpoint fixture still reports a 1.74 m position snap miss (1.5 m target), outside these named rows. Other browser-only acceptance clauses remain incomplete.
- Fresh `npm run qa:accept -- --level L7 --skip-browser --tier high|low`: L7-04 passes both tiers. The unrelated L7-01 row remains a fresh failure; stationary policies ended at their tick budget.
- `node --import tsx/esm tools/qa/threat-audit.ts --levels L7,L9`: zero L7/L9 threat flags. Its sole top-level flag is `PARTIAL_LEVEL_SELECTION:diagnostic run, not a complete gate`, which the brief says to ignore.

## Visual evidence

HIGH then LOW captures were made through the browser pool and opened. The [high boarding](high/01-mega-boards.png) and [low boarding](low/01-mega-boards.png) frames show the Mega on the APC roof; the [high fall](high/03-collapse-progress.png) and [low fall](low/03-collapse-progress.png) frames show separated, tilted bridge sections in the gully behind the APC, with the Mega still aboard. A stale school-bus warning remains visible. The initial collapse frames are [high](high/02-bridge-collapse.png) and [low](low/02-bridge-collapse.png). The earlier variant that cut the approach ground was reverted after its high capture failed to show a collapse. The final change places four animated spans over the actual gully and sequences their drop from the fall phase.

Files changed for gameplay/checking: `src/sim/missions/LevelNineSetPieces.ts`, `src/sim/missions/LevelNineCrash.ts`, `src/render/L9Props.ts`, `src/sim/missions/LevelSevenEncounters.ts`, `src/sim/missions/Mission.ts`, `tools/qa/accept/evaluate.ts`, `tools/qa/accept/observer.ts`, and `tools/qa/f5-l9-bridge-capture.ts`. Fresh acceptance receipts and indexes are under `docs/reports/fix51-verify/`.
