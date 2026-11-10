# r26-l8follow: L8 zebra carrier dead time and follower 364

Finding (queue): "[P3] L8 follower 364 SLOW_FOLLOWER 89.6 % of group median in passive phase/breached after arena-engage fix (r23-skilledreg 432b4ded); L8 zebra carrier (runner 472) stuck 'attracted' at (-10,-26) -> ~74 s paddock dead time."

## 1. Zebra carrier: root cause and fix (commit 37040f69)

Arena carriers (`LevelEightZoo.arenaCarrier`) come out of the nearest tunnel outlet and walk its authored service route in `walkResidents`. Outlet 2 (north gate) routes `[-11,-40] -> [-11,-24] -> [1,-19.2]` along the west side of the flamingo pen. By the time the flamingo arena has run (t = 100 s), a pen fence panel (blocker 1882523624, originally at (-14,-24.6)) has been knocked flat into that line: a 2.75 x 2.46 m, 0.65 m high solid at (-11.4,-25.4). The walker pushes into it every tick and the physics commit pushes it back, so it stays at (-11.0,-26.95) with `emerging = true`, `state = attracted`, forever. The whole outlet-2 cohort (runner 475 too) is pinned there, not only the carrier. The arena then only starts when the herd turns for another reason (here: the bot walking in, 74 s later).

Fix (`src/sim/outbreak/HouseEmergence.ts`): for `finishRoute` houses (L8 only) a resident whose position has not advanced for 90 ticks (1.5 s) leaves the scripted walk (`leg = route.length`) and is handed to the AI, whose nav routes around the obstacle. No speed, stat or route change; arena and boss tuning untouched. Regression check in `tests/engine/missions.test.ts` (L8 block): a flat barrier on the route, one resident, must be handed over; verified to fail without the fix ("expected [] to include 439").

### Numbers (`tools/qa/diag/l8carrier.ts`, seconds from the courier entering the arena trigger to arena start; `?` = arena already running when the courier arrived, i.e. no waiting)

| seed | zebra wait before | zebra wait after | skilled run before | skilled run after |
|---|---|---|---|---|
| 1 | 81 s | 0 (herd turned 159 s, courier arrived later) | 560 s | 623 s (see section 3) |
| 2 | ? | ? | 532 s | 507 s |
| 3 | 84 s | 0 | does not finish (1200 s tick budget) | 500 s |
| 4 | not measured | not measured | 533 s | 507 s |
| 5 | not measured | not measured | 492 s | 492 s |
| 6 | not measured | not measured | 579 s | 498 s |

Seed 1 trace after the fix: carrier 472 leaves the pen shore at t = 104 s and chases (it was shot by the courier at 107 s), the next carrier 490 reaches the zebras at t = 155 s and the arena starts at 159 s (was 223 s). 0 collision failures in the skilled runs.

## 2. Follower 364: no systematic fault, flag is seed-1 noise

* The flag is not from the passive window (passive 364 = 4.50 m/s = 100 % on all three seeds, before and after). It is the skilled moving route, `phase/breached`, seed 1: 364 at 2.72 vs group median 3.03 = 89.8 % (reproduced locally by `tools/qa/diag/l8follow.ts 1 skilled` and in the remote `qa:threat --levels L8`).
* Baseline across seeds 1-6 (skilled, 364 ratio): 0.90, 1.00, 1.00, 1.05, 1.00, 1.00. Only seed 1 dips. The dips (listing of the 2 s trace where 364 is under 90 % of the median while the leader walks) are scattered over the flamingo fight (t = 94-126: 364 pinned at (0,-10) and (-6,-15) for 4-10 s in the crowd), gorilla and elephant fights, i.e. contact and re-alignment losses around combat, the same mechanism recorded in lessons-learned for r2-l5. There is no path detour, no speed cap and no per-ID difference for 364.
* Any change to the route reshuffles which follower dips (lessons 2026-11-07 r2-l5). After the carrier fix: seed 1 364 = 103 % and the remote `qa:threat --levels L8` shows 0 passive flags and no SLOW_FOLLOWER (only the always-present PARTIAL_LEVEL_SELECTION). Local 6-seed aggregate of followers under 95 % of the median: baseline 3 of ~84 follower-seeds (s1 364, s3 354, s4 355 with 147 samples), after 6 of ~84 (s1 354 91 %, s3 354/359/364, s4 357) = same noise band; the individual follower that dips changes with the route. Not a pass/fail difference attributable to the code.
* Tried and reverted: catch-up headroom for followers more than 1 m behind their slot (`cap = courierSpeed * 1.05 + gap * 0.5`). It shifted the group median up and produced 13 followers under 95 % over the 6 seeds. Not committed.
* The 0.95 gate on one follower of one seed is the weak spot, not the follower: the threat audit votes L5/L7 over seeds 1-3; L8 still uses one seed. Suggest the same 2-of-3 vote for L8 in `followerPaceVerdict` (not changed here).

## 3. Open: boarding queue pinned beside the elephant corpse (seed 1, after the fix)

Seed 1 now takes 623 s because the evacuation group idles ~75 s after the elephant fight (541 -> 616 s). `tools/qa/diag/l8board.ts 1 538 600`: the queue head (354, the corgi) sits at (102.7,56.2) from 546 to 576 s with the dead elephant at (104,58), 11 followers jammed around it at 102-104,54-56, and infected runners/an alpha attacking the group in the yard; `boardingDetours` stays empty until 576 because `corpseDetour` finds no free 0.75 m grid cell while the crowd stands around the head. Baseline seed 1 finished the same phase in 11 s, so the stall is chaotic (seeds 2-6 finish in 492-558 s), but it is the kind of dead time the PO calls boring. Needs its own lane: let the boarding head relocate/slide off the corpse (or accept `clear(...bodies=false)` for the detour search) and have the group fight the yard infected rather than stand.

## Checks

* `npx tsc --noEmit`: clean. `eslint` on changed files: clean.
* `tests/engine/missions.test.ts` on the runner: 6/6 pass (new assertion fails without the fix).
* `npm run test:gate` on the runner: 105 pass, 1 fail, `tests/tools/gate-tools.test.ts:67` runs `git rev-parse HEAD` in the runner's commit-less manifest repo (environmental, unrelated; present on main).
* Remote `qa:threat --levels L8`: baseline flags `L8/phase/breached:SLOW_FOLLOWER:364`; with the fix none (PARTIAL_LEVEL_SELECTION only).
* Diagnostics added: `tools/qa/diag/l8carrier.ts` (arena wait per seed), `l8follow.ts` (observer follower speeds, optional 2 s trace), `l8board.ts` (boarding queue head).

## Browser QA needed

* L8, zebra paddock, quality low and high, zoom 1 and 1.5: play from the flamingo fight onward with a progressed save. Check that a runner comes out of the north gate tunnel (about (-30,-69)), walks the pen's west side, is not frozen at the pond edge around (-11,-27) when a fence panel lies on the line (knock the west pen fence down with the flamingo fight / rocket), and that the zebra herd turns and the arena starts within about 20 s of the courier entering the paddock (no minute of standing in an empty pen).
* L8 yard, tick ~540-620 s on a normal run: after the elephant dies, watch the evacuation group queue to the APC; report any idle stretch longer than 15 s next to the elephant corpse (open item 3).
