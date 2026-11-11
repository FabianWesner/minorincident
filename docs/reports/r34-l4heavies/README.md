# r34-l4heavies: fewer heavies in L4, thinned at the source

PO 11-10: "'It's an Alpha' ok, but in the army level there are tons of them." r33 gave the heavies their own bodies but the L4 share
stayed ~24 % (29 of 120); runtime thinning either did nothing or delayed breach first contact.

## Change
- `src/data/l4.ts`: `l4ArrivalRoster(index)` replaces the r33 knobs. A default arrival draw offers the six ordinary types (runner, crawler,
  sprinter, riot, firefighter, hazmat) plus ONE rotating heavy (brute/armored/butcher; 1 of 7 = 14 % of an even draw) and, when
  `index % 3 === 2`, a second heavy (2 of 8). The draw is still least-represented-first (`balancedCrowdModel`), no gameplay RNG, no stat,
  count or wave-size change. All three heavies still appear.
- `src/sim/missions/LevelFourWar.ts`: `emerge` uses the roster for the default roster; the spearhead roster (runner/sprinter) is untouched.
  Removed `thinningOpen`, `breachCohortWindow` and the knobs `l4HeavyReplaceShare`, `l4HeavyThinFrom`, `l4HeavyThinFromS`,
  `l4HeavyBreachWindowS`, `l4HeavyStandIns`. The authored wave/roster data itself holds only the flat archetype list, so the roster is the lever.

## Census (tools/qa/r33/heavy-census.ts, seed 1, complete)
| | Heavies | Share |
|---|---|---|
| before (r33 shipped, from its README) | 29 of 120 | 24.2 % |
| after | 23 of 124 | 18.5 % |

(Pair on `index % 3 === 0`: 21 of 119 = 17.6 % but the skilled hold phase flags UNREACHABLE; on `=== 1`: 23 of 127 = 18.1 % with the same
hold flag. Which arrivals carry the pair decides whether a few heavies end up in the hold phase the wire needs; `=== 2` is the variant
that keeps the audit at baseline. It is deterministic but sensitive to this phase, so a future change to arrival order can move it.)

## Threat audit (`threat-audit.ts --levels L4`, skilled seed 1)
Main now (same harness): skilled flag set = `wave/war-0@1969:WAVE_FIRST_ATTACK_OVER_20_SECONDS` only. After: the same single flag, nothing new
(breach-south "fewer than three" does not appear). Skilled L4 completes. The report's other L4 FAIL rows (L4-06 first breach 36 alive,
sustained horde) are the known baseline rows and are the same as on main. L4 contact, director-pressure, determinism and render-contract
tests pass; tsc and eslint clean. `npm run test:gate`: 106/107, the one failure (`gate-tools` browser-pool WindowServer back-off test) is
unrelated. `tests/qa/invariants/waves` nightly fails on L1-L10 census rows that do not include L4 (also failing on baseline per r33).
