# s192-l7harder — L7 encounter pass

## Result

L7 now authors **560 HIGH / 280 LOW** regular infected (+40%) and keeps concurrent caps at **200 / 100**. The higher 240 / 120 caps were not enabled: the native sim proxy measured HIGH update p95 at **4.12 ms** at 200 active and **4.31 ms** at 240, against the 4 ms HIGH budget. HIGH peak active count in the final native acceptance route was 200; peak living characters were 236. Real-device frame timing remains pending.

Opening and subsequent street groups use road-connected placements spread across the road and its verges, with each scheduled wave requested in one tick. The opening selects a 16-runner advance party using angular sectors; the authored population is delivered through the existing queue/recycling path. Requests do not prove actual arrivals from three directions within five seconds: admission, pathing, and the moving column must be measured for every fight. That requirement remains open. The final HIGH horde is 168 (LOW 84). Zombie stats are unchanged.

## Survival and completion

| HIGH skilled native route | Before (400 regulars) | After (560 regulars) |
|---|---:|---:|
| Route | Complete, 107.67 sim s | Complete, 107.48 sim s |
| Courier deaths | 0 | 0 |
| Damage taken | — | 190 |
| Evacuees saved | 14 / 24 | 7 / 24 |
| Evacuees killed / turned | 0 / 10 | 12 / 2 |

The harder HIGH route still completes through bus departure. The larger stream shifts more losses from turning to direct deaths while keeping courier deaths at zero. The passive LOW threat route also completes with 24 / 24 saved.

## Checks

- `npm run typecheck` — pass.
- `npm run lint` — pass.
- `npm test` — pass, 106 tests in 27 files.
- `npm run qa:threat` — pass, **0 flags**; L7 skilled and passive routes complete, kiting probe landed 1 hit in 20 seconds (3/min), and follower pace passes across seeds 1–3.
- HIGH local acceptance command `npm run qa:accept -- --level L7 --skip-browser --tier high --policy complete` — native route complete; 8 fixture clauses and 3 checkpoints pass with 0 errors. Report assembly then exits because historical criterion `G-28` is missing from the report source rows in `tools/qa/accept/report.ts`.
- Remote unit suite passed: 105 passed, 1 skipped, 27 files. Both remote HIGH and LOW acceptance routes completed, with 8 fixture clauses and 3 checkpoints passing per tier; both report assemblies exited on missing historical criterion `G-28`. The pulled `docs/reports/fix51-verify` files were restored.
- Native proxy timing is recorded above; real-device timing is pending.

## Visual capture

The HIGH zoom-1 headless playtest ran under the browser lock on port 5125, but its input bot remained at the launcher until the five-minute cap. No junction capture is claimed.

## Changed acceptance rows

`docs/qa/level-acceptance.md` L7-04 / L7-05 and Epic 29 AC08 / AC19 record the PO quote, revised population, conditional cap ceiling and the requirement for at least three road-connected arrival directions within five seconds per street/junction fight. Existing unrelated targets are retained.
