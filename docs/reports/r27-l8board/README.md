# r27-l8board: L8 boarding stall beside the elephant corpse

Finding (r26-l8follow): "Seed 1 now takes 623 s because the evacuation group idles about 75 s after the elephant fight. The queue head (the corgi, 354) sits beside the dead elephant for about 30 s while the group is jammed around it and yard infected attack. The corpse detour search finds no free cell until the crowd thins."

## Root cause (three stacked causes, seed 1 reproduced on the Mac with `tools/qa/diag/l8board.ts 1 538 620`)

1. `corpseDetour` (L8 branch, `src/sim/missions/missionHelpers.ts`) rejected every candidate cell and swept leg through living actors, so a packed evacuation group left no free cell. Living actors are soft here now; only statics and large corpses veto a cell.
2. Even without the crowd, the first leg failed `clearOfCorpses`: the corgi's capsule (0.44 + 0.4 m) already overlaps the elephant footprint (1.75 m apart, 2.04 m needed), so every leg that starts there "touches" the corpse. A leg that only moves away from a corpse it already overlaps is now accepted (`leavesCorpses`).
3. With a detour in hand the head still did not move: the head and about six cashiers were pressed into one clump at (102-103, 54-56). The atomic contact commit rejects every proposal that overlaps a neighbour's pose, so nobody had a legal step (deadlock, not slowness). `LevelEightZoo.unjamBoarding` (called from `follower` and `companion` while boarding): a member that has not advanced 0.25 m for 1.5 s and is more than 1 m from its target is relocated at most 1.5 m toward it with `solids.relocate` (nearest physically clear spot, same call the door approach uses). Tried and reverted: exempting the blocking group member via `contactExempt` (the corgi then wandered against the elephant and the queue was slower).

Fourth finding on seed 3 (runner): once the group boarded sooner, the skilled bot's courier stood at (87,71) pushing east into the elephant corpse that lay at (88.4,69.8) beside the APC and never reached the door (run did not finish in 1300 s). Players steer around; the bot did not. `LevelEightBot` now takes the first `corpseDetour` waypoint while walking to the door.

No infected stat, speed, tolerance or route change. Deterministic (no randomness, tick-based).

## Numbers (skilled L8 run end time, seconds, `tools/qa/diag/l8carrier.ts N quiet`; idle from `tools/qa/diag/l8idle.ts`)

Baseline on the Mac (r26-l8follow): 623 / 507 / 500 / 507 / 492 / 498. Runs differ between the Mac and the Hetzner runner (floating point / scheduling), so the runner has its own baseline:

| seed | runner before | runner after | worst idle of any unseated member while boarding is open (after) | corgi/head idle (after) |
|---|---|---|---|---|
| 1 | 551 | 553 | 4.3 s | 1.6 s |
| 2 | 522 | 517 | 2.8 s | 1.7 s |
| 3 | 605 | 572 | 5.3 s | 2.5 s |
| 4 | 509 | 534 | 4.8 s | 3.9 s |
| 5 | 492 | 491 | 5.3 s | 1.8 s |
| 6 | 530 | 530 | 2.5 s | 1.3 s |

* The seed-1 stall does not occur on the runner trajectory; it occurs on the Mac. Mac seed 1 after the fix: 599 s (was 623 s), head moving from 546 s, boarding complete at ~594 s (was ~618 s) in `l8board.ts`.
* Target "no follower or queue head stationary > 5 s while boarding is open": head max 3.9 s; worst member 5.3 s on seeds 3 and 5 (a soldier and a cashier waiting 0.3 s over the line, still walking into the queue; not a jam). All six seeds finish.
* The run-to-run end times are chaotic (any change reshuffles fights, see lessons-learned r2-l5); the metric that matters here is idle time during boarding, measured with the new tool.

## Checks

* `npx tsc --noEmit` clean; eslint clean on the changed files.
* `tests/engine/missions.test.ts` (L8 block, no new test case): a settled elephant 1.75 m from the corgi must give `corpseDetour` a way out (fails on main: the first leg is rejected), and `unjamBoarding` must move a member stalled for 100 ticks by more than 0.5 m. 6/6 pass on the runner.
* `npm run test:gate` on the runner: 27 files, 106 passed, 1 skipped (176 s).
* Diagnostics: `l8board.ts` (queue head, existing), `l8boarddbg.ts` (per-tick head state), `l8idle.ts` + `l8idle-all.sh` + `l8ends.sh` (idle and end time for seeds 1-6), `l8end.ts` (APC phase dump). Caution: `zoo.passengers()` refreshes the roster cache; diagnostics read `passengersCache`.

## Note for r27-l9board

Shared code touched: `corpseDetour` (L8 branch only, guarded by `world.scenario === 'L8'`; the generic branch used by L7/survivors is unchanged; `leavesCorpses` is defined before the branch but only used inside it) and two new calls in `LevelEightZoo.follower/companion`. Nothing in L9 code or `LevelNineDriving.ts`.

## Browser QA needed

* L8 yard, quality low and high, zoom 1 and 1.5: after the elephant dies (around 540-600 s on a normal run), the corgi and survivors queue to the APC without standing next to the elephant corpse for more than a few seconds. Check for visible 1.5 m hops (the unjam relocation) - they should be rare and not visible in a crowd.
* L8 yard, player on foot: walk to the APC door when a boss corpse lies beside it; nothing about player movement changed.
