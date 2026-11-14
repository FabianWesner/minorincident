# s116 / s116b — resumable infected A*

**Complete.** Validated gameplay revision: `c5e30143`; base: `e1901bb7` (s114 + s115). Historical experiments in `evidence.json` are superseded by `releaseValidation`.

## Result

Long requests retain their A* frontier across competing callers. Native L4 HIGH seed 1 actor 298 requests at tick 3011 and receives its path at 3086: **1.25 s, six calls, 9752 total expansions**. Normal/wide per-tick expansion allowances, route-slot limits and retry delays are unchanged.

| Native seed-1 alarm hold | Base HIGH | Final HIGH | Base LOW | Final LOW |
| --- | ---: | ---: | ---: | ---: |
| Requests unresolved at the 10 s deadline | 4 | **0** | 4 | **0** |
| Peak stationary outside plaza (sliding 30 samples) | 2 | **1** | 1 | **1** |
| Alive at first breach | 72 | **72** | 47 | **46** |
| Sustained plaza minimum after 45 s | 40 | **42** | 16 | **17** |

L4-06 HIGH passes. Full all-level threat audit: **zero flags**, 440.6 s. All **eight vehicle campaign cases pass** on the same gameplay source.

## Implementation

- `NavGrid.path` saves sparse visited-cell state and the heap under each reused output array. A WeakMap allows abandoned arrays and their saved searches to be collected. Restoration requires matching endpoints and grid revision.
- Cached-waypoint visibility checks now cover ordinary infected chasers as well as army approaches, resolving the L10 hold's stuck chaser.
- Officers recognize L1 bite holds against the party in the existing committed-attack rescue priority. This resolves the L3 squad regression without changing range, visibility, friendly-fire checks, damage, cadence or acceptance thresholds. Other ally roles retain their previous priorities.
- The L9 pursuing bus spawns on a bounded, distance-spaced trail of the APC's driven path instead of a 110 m backward projection of its instantaneous dodge heading. The trailing pose is interpolated within the trail and both entity and physics headings use its tangent. A teleport-sized discontinuity resets the history. This preserves the trailing distance and existing bus speed, damage, passengers and stop rules.

No zombie/weapon stats, audit thresholds/policies, living-infected removal/teleportation, corpse behavior, authored specs or protected assets changed. No deployment, push or main-branch movement.

## s116b L9 LOW diagnosis

Exact candidate telemetry disproved the initial inference from sparse progress samples: its hatch **opens at tick 5984** and closes normally at restart **7184**, inside the unchanged 9000-frame gate. Base triggers the rail hold at **6141** and provides hatch/rail-stall contacts. There are no candidate deaths or driver-ownership changes through the hold.

Resumed infected navigation changes the APC's avoidance/heading history. The old bus spawn projected its transient heading backward, putting the pursuing bus off the driven lane. Candidate bus 675 became permanently stopped near **(3.8,-321.9)**, while base bus 675 reached the rail hold near **(375.8,-218.3)**. Its passengers therefore reached the hatch defence on base but spilled far behind on the candidate. Correcting the trailing placement restores native bus arrival and grounded contact coverage; no gate change was needed.

Final L9 receipts:

| Tier | Rail-stall trigger | Hatch/rail-stall frames | Actors | Contacts | Maximum slide |
| --- | ---: | ---: | ---: | ---: | ---: |
| HIGH | 6276 | 368 | 6 | 31 | 1.2 cm |
| LOW | 5984 | 129 | 4 | 12 | 1.4 cm |

Both tiers have all required contexts, no failed rows, no correction failures and no browser errors. Pursuit-target, leaper-range and prediction experiments were discarded; the bus placement is the only retained s116b gameplay correction.

## Verification

- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- Full unchanged remote unit suite: PASS on 46.225.66.90; **27 files, 106 passed / 1 skipped, 223.7 s within 240 s**, manifest 150/150. Earlier runner timeouts were rerun unchanged; no tests were trimmed and no budget was raised.
- Focused A* regression: competing routes complete within supplied budgets; twelve obstacle layouts match uninterrupted A*; blocker and destination changes invalidate saved frontiers. Added coverage stays within the existing test case.
- Full `node --import tsx/esm tools/qa/threat-audit.ts`: PASS, all levels, **zero flags**.
- Fresh final native HIGH/LOW path observer: **zero overdue requests on both tiers**. Matched base runs detect four per tier, including HIGH actor 298.
- `npm run qa:vehicle-campaign-motion`: PASS, **all eight HIGH/LOW cases** (L9, L7 bus, L4 parked, L4 tank) through `tools/e2e-lock.sh`, one serial headless browser, ten-minute reservation, E2E_PORT/SCENE_PORT **4961/4962**. Every receipt is source-stable and all eight share the same source hash.
- **Browser QA needed.**

## Measurement and evidence

`tools/qa/s116-path-probe.ts` wraps actual path calls without advancing navigation. It follows pending requests across cached-goal resets and records actual destination changes, flow replacement, successful direct visibility to the exact scripted destination, exhausted searches, or actors leaving navigation. Cancellation after 600 ticks does not erase an overdue request. The corrected observer detects the base failures as well as final success.

An earlier cached-goal-reset cancellation rule masked base starvation; its zero-starvation claim was withdrawn and that rule removed. Historical failures and discarded variants remain in `evidence.json` for traceability. `releaseValidation` contains the final audit, native holds, unit results and eight vehicle receipts. Earlier blocked-delivery and missing-context statements describe superseded revisions, not the final result.
