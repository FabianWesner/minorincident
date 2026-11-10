# R23 skilled-run regressions: L9 skilled failure and L8 skilled duration

Branch `lane/r23-skilledreg`, based on main 5cd93f3c. All runs on the Hetzner runners, seed 1, low tier, no browsers.

## L9 skilled: root cause and fix

Symptom: `mission-failed`, 600 sim-s tick budget, 726-1,012 `collision-invariant` failures (r16: complete in 217 s).

Bisect (`git bisect run` against a faithful single-stage repro, `tools/qa/diag/l9audit.ts`, r16 merge 910607e9 good, main bad) landed on e715049e (the last of the L8-series commits that edit `src/debug/bot/LevelNineBot.ts`). Checking the r16 bot file on current main proves it: **r16 bot on main = complete in 210 s, 0 failures**, so the game and sim code are not at fault.

Cause (bot, in the part that runs after the evacuation is done): the bot steered through waypoints at 0.45 throttle whenever the heading error was above 0.8 rad, plus a handbrake whenever boarders were attached. During the 30 s defend window the pursuing bus shoves the braked APC about 10 m north (z 5 to 15, yaw about -1.4). The bot then has to turn about 120 degrees; at 0.45 throttle it crawls at 0.2-0.6 m/s next to the gate, the bus rams it again (4 m/s impact), the horde (15-34 infected in contact) mobs the car and the run idles to the 600 s budget. The collision failures are shallow actor-actor overlaps (0.02-0.09 m, writers `cleanup.separation` and `infected.update`) in that stationary pile, not a solid-geometry problem. The same code passes at the high tier only because the horde there is larger but arrives later.

Fix (41518390): after `evacuationDone` the bot drives straight for the bridge at full throttle (the r16 behaviour); waypoints, the part throttle and the handbrake shake are gone. No invariant, seed, target or bot-limit loosening.

Evidence (faithful `threat-audit.ts --levels L9`):

| | before (main) | after |
|---|---:|---:|
| L9 skilled outcome | mission-failed, 600 s | complete, 222 s |
| collision-invariant failures | 1,012 (726 in proof harness) | 0 |
| L9 passive | complete | complete (0 flags) |
| stage wall time | 189 s | 60 s |

`tools/qa/l9-driving-proof.ts` after the fix: road low complete 222 s / 0 failures; road high complete 216 s / 0 failures. Not fixed, not in the audit: `--risky` low (completed at 265 s with 24 failures on the r16 bot, incomplete on main both before and after the fix), `--zero` (never completed, also on the r16 bot) and `--route countryside` (incomplete on main and on the r16 bot).

Observation for the orchestrator (game, not touched): the pursuing bus pushes the parked, braked APC about 10 m during the evacuation hold and rams it again as soon as it moves. A player would feel this as the APC being bulldozed north; it may be intended pressure, but it is what sets up the stall.

## L8 skilled: mixed design and a real dead time

Skilled run takes 871 sim-s on main (r16: 177 s). Per-arena breakdown from `tools/qa/diag/l8trace.ts` (the shipped bot, `complete` policy), before the fix:

| span | sim-s |
|---|---:|
| flamingo engaged 86 to cleared 126 | 40 |
| walk into the zebra paddock 126 to 150, then **idle at (59,27) until 489** | **339 idle** |
| zebra 489 to 521 | 32 |
| monkey 540 to 591 | 51 |
| lion 603 to 649 | 46 |
| gorilla 690 to 747 | 57 |
| elephant (final, at the APC) 771 to 831 | 60 |
| depart 864 to 872 | 8 |

So about 290 s of boss fights plus about 250 s of walking between gated arenas are the intended design (PO 2026-11-09: arenas gate the route, elephant last). The 339 s idle is a game gap. The zebras are still civilians when the courier walks in; the arena only engages inside 12 m of `entry` (60,8) or on provocation. The courier stood 19 m from the entry, inside the paddock; the herd turned about 300 s in and stayed `alerted` and unengaged for another ~190 s (arena phase 0). Nothing the player does inside the pen starts the fight. A related oddity: the zebra carrier (infected runner 472) sat in `attracted` at (-10,-26) for the whole time and never walked to the herd.

Fix (432b4ded, `src/sim/missions/L8BossArenas.ts`): an arena also engages when the courier is inside 0.75 x its radius from its centre (same `routeOpen`/`live` conditions, so the order of arenas and the gating are unchanged). Arenas and bosses are not weakened.

After: L8 skilled complete in 560 sim-s (was 871), 0 collision failures, same arena order. Remaining dead time: about 74 s in the paddock waiting for the herd to turn (150 to 224), which is the carrier above (open).

Per-arena after: flamingo 40 s, zebra 36 s, monkey 53 s, lion 41 s, gorilla 60 s, elephant 39 s, walking and waiting the rest.

## Threat receipts

- L8, L9: see above. Full-audit comparison of the other eight levels was not run (the r23-threattime comparison tool and receipts were removed while I worked, and a full run exceeds the box). The changes only touch the L9 bot and `L8BossArenas`, which no other level runs, so their receipts cannot change.
- L8 flags before and after are the same two skilled flags: `step/escape` and `phase/breached` SLOW_FOLLOWER (a follower median under 95 % of the leader) and `wave/tunnel-breach` WAVE_FIRST_ATTACK_OVER_20_SECONDS. They pre-exist (main shows the same at 361 vs 364 entity id).
- **New with the L8 fix**: the L8 passive window (150 s) now shows one `phase/breached` SLOW_FOLLOWER flag (follower 364); on main the passive run had 0 flags. Cause not investigated: the passive courier now engages the zebra arena earlier in the window. Needs a decision: narrow the engagement condition, or accept as a follower-pace artifact.

## Checks

- `tsc --noEmit` clean. `npm run test:gate` on a runner: 2 failures out of 107, `tests/engine/player.test.ts` (movement acceleration) and `tests/tools/gate-tools.test.ts` (browser pool WindowServer back-off). Neither touches the changed files; not run on main for comparison.
- Diagnostics added: `tools/qa/diag/l9audit.ts` (single-stage faithful L9 skilled run, exit code = pass), `tools/qa/diag/l8trace.ts` (objective, arena phase and position timeline).

## Open

1. L8 passive SLOW_FOLLOWER flag (above).
2. L8 zebra carrier stuck in `attracted` (about 74 s remaining dead time).
3. L9 `--risky` / `--zero` / `countryside` proof variants incomplete; bus shoving the parked APC.
4. Full nine-level receipt comparison not run.
