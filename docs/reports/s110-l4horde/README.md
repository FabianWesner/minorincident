# s110-l4horde — incomplete investigation

L4-06 remains failing. Browser QA needed. Time box exceeded; unsuccessful gameplay trials have been removed. This commit preserves additional HIGH/LOW and stationary census diagnostics, without changing gameplay, audit thresholds, or existing policies.

## Evidence

The task baseline HIGH census was 44 alive at first breach, plaza minimum 17; final-b documented HIGH 65/minimum 54 and LOW 67/minimum 52. Final-b source revision: `4e570db8499bd1d76dcc17f9d13d1949d5cf2096`.

`16bf032c` removed L4's repeat-downing retirement rule and arrival-specific allied-damage resistance. `SpawnDirector.count` in the same commit also removed the L4 LOW living-only exception: LOW now counts recoverable downed actors against its strict cap, whereas before it counted living infected only. This is a separate cap-admission regression candidate and must be isolated from damage resistance and retirement in the bisect. These are strong regression candidates; restoring retirement experimentally improved the sustained HIGH count, but the complete commit-by-commit bisect is unfinished. The resistance override was not restored because the task forbids zombie stat differences. Retirement also changes recovery behavior, so that experiment is removed from the delivered source.

A residency cap bypass experiment did not change the measured HIGH/LOW census, providing evidence against reserved-slot sleep as the cause in the tested run. It is not a general proof about residency.

A combined trial (delayed alarm reinforcements, changed LOW cap/waves, restored downed retirement and targeting changes) reached HIGH 75 at breach / minimum 40; LOW 76 / minimum 21. The complete and stationary policies produced identical hold metrics. These are experimental results, not results for the delivered gameplay. LOW had 70 living infected overall at its minimum, but only 21 in the authored plaza and 7 inside the perimeter.

Removing the experimental LOW retargeting branch produced LOW 76 living overall at its minimum, plaza 15, perimeter 3. Several survivors were north of the plaza near z=-37.5 while assigned an outside waypoint at the west breach, x=-37.2/z=6.1. Recalculating the nearest open breach worsened the plaza minimum to 13; that trial was removed. The attached JSON records these two experimental runs, including stranded positions. It must not be interpreted as current-source acceptance evidence.

Allowing supplemental pressure to bypass the corpse-field stop increased LOW minimum only to 22 and caused the skilled route to hit its tick budget. Removed. No corpses were removed in these trials. The temporary LOW infected-cap increase from 80 to 100 is also removed; delivered live caps are unchanged, so no delivered live-count/performance increase is claimed.

## Remaining work

- Finish the historical bisect with comparable policies and receipts.
- Trace north-to-west exterior navigation and determine why live arrivals remain outside the plaza.
- Implement a level/director fix preserving shared zombie/weapon stats, recovery rules and persistent corpses.
- Prove both clauses on HIGH and LOW, then run the full threat audit and compare flags across every level.
- Run lint and the remote unit suite: `sh tools/remote/run.sh "$PWD" -- npm test` (rerun unchanged on runner timeout).

The final full audit and remote suite have not been run. Typecheck and lint passed after removal of the unsuccessful gameplay trials. No deployment, push, or main movement was performed.

## Isolated LOW cap experiment

Restoring only the former L4 LOW living-only `SpawnDirector.count` exception (otherwise delivered gameplay unchanged) measured 54 alive at breach at level 50.233 s, plaza minimum 56, peak alive 129, and 39 recoverable downed at the end. This supports strict downed-slot admission as a cause of the sustained LOW failure. It does not solve first-breach population. The 129 peak exceeds the authored LOW infected cap of 80 because recoveries can overlap new admissions; this trial was reverted, with no performance claim. A bounded solution must reserve recovery capacity or otherwise reconcile authored arrivals and recovery without per-level zombie stat changes. The JSON contains this isolated receipt.
