# s110-l4horde — committed candidate, one new audit flag open

Current gameplay commit: `d35b0f2b`. L4-06 passes HIGH and LOW, but the full requested outcome remains incomplete because the full audit reports a new L4 north breach cohort flag. No further gameplay experiments were made after the orchestrator instruction.

| Tier | Breach level seconds | Alive at breach | Minimum plaza alive | Peak living |
|---|---:|---:|---:|---:|
| HIGH | 50.083 | 72 | 42 | 91 |
| LOW | 50.083 | 67 | 55 | 107 |

Full all-level audit: 521.1 seconds, exit 1, exactly two flags:

- NEW: `L4/wave/breach-north:WAVE_FEWER_THAN_THREE_COHORT_MEMBERS` (one admitted member; first attack 10.583 seconds). This is outside the allowed baseline and remains open.
- Allowed existing: `L6/early-close/wave/l6.breach2:WAVE_FIRST_ATTACK_OVER_20_SECONDS`.

Both former L4-06 criterion flags are absent. L4 skilled route completed. All other levels have no fail flags. The compact final receipt is `final-audit.json`; complete generated receipts remain in `test-results/qa-threat/`.

Typecheck and lint passed for the candidate. Required unchanged remote `sh tools/remote/run.sh "$PWD" -- npm test` passed, exit 0: manifest 150/150 cases, executed default project 106 passed / 1 skipped across 27 files, 221.7 seconds against 240-second budget. Runner job `/srv/mi/jobs/s110-l4horde-c91a91-59619-1794661080`. No rerun or trimmed tests. Browser QA needed. Orchestrator owns LOW frame-time measurement after merge.

Root-cause evidence: commit `16bf032c` removed arrival allied-damage resistance and repeat-downing retirement, and changed LOW cap accounting to reserve recoverable downed slots. The isolated LOW accounting reversal reached minimum plaza 56 but peak living 129; reverted because unbounded recoveries make it unsuitable. Current candidate preserves strict recovery accounting and compensates through authored budgets. A complete historical per-commit bisect is still open; evidence supports this commit's admission/recovery changes as a contributor, not a proven exclusive cause. Residency bypass did not alter the tested census. Complete and stationary hold policies matched in the tested comparison.

Performance note: infected slot caps increase HIGH 120→160 and LOW 80→144; character caps increase 190→230 and 120→184. Alarm cohort increases 18→36. Slots include downed actors, so they differ from peak living counts (91 HIGH / 107 LOW). Exact baseline peak-live deltas and frame-time measurements remain open. Combat stats, recovery rules, persistent corpses, audit policies and thresholds are unchanged.

## Investigation history (superseded status statements below)


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

## Current budget candidate — focused clauses pass, validation pending

The uncommitted current candidate uses alarm cohort 36 (formerly 18), infected slot caps HIGH 160 / LOW 144 (formerly 120 / 80), and character caps 230 / 184 (formerly 190 / 120). Strict recovery reservations are unchanged. Focused native complete-policy passive census: HIGH first breach 72 alive, plaza minimum 42, peak living 91; LOW 67 / 55 / peak 107. No zombie or weapon stats, recovery timers, corpse persistence, thresholds or policies changed. These results supersede the earlier statement that no gameplay candidate remains, but do not prove the full goal.

Performance note: infected slot budget rises +40 HIGH / +64 LOW; character budget rises +40 / +64. The budget includes recoverable downed actors, so slot increases are not equivalent to living-count increases. Candidate peak living counts are 91 HIGH / 107 LOW; exact current-source baseline peak comparisons and orchestrator frame-budget measurement remain required. The user specified that performance is measured later by the orchestrator; this note does not claim a measured frame-time pass. Full audit, skilled completion, tsc/lint after this data change and remote suite remain pending.

Orchestrator direction: commit the cohort-36 / HIGH-160 / LOW-144 candidate, stop gameplay experiments, run the full threat audit and compare against the permitted baseline (L4-06 first breach, L4-06 sustained horde, and L6 breach2 only). LOW frame time will be measured by the orchestrator after merge. Typecheck and lint passed for this candidate; the required remote suite is in progress. Full audit still pending at this commit.
