# L6 follow-up

The lane is incomplete: the early-close threat audit still has two reachability flags. No acceptance criteria or checker were changed.

| Measure | Before, low / high | After, low / high |
|---|---|---|
| L6-07 retreat damage | 30 / 30 HP | 55 / 55 HP; 12.86 combined windups/min, peak 11 infected |
| L6-10 marker | 0 / 0 failed branches of 12 | 0 / 0 failed branches of 12; no trajectory offenders |
| L6-13 unarmed maneuver | 248.9 / 248.9 s, 5 deaths | 632.02 / 632.02 s, 20 deaths; complete, fists only |
| L6 threat audit | 2 exit pacing flags | 2 early-close retreat unreachable flags; exit pacing flags cleared |

Pressure spawns used the courier's x coordinate instead of the selected door's x. The spawn now remains at the door; the skilled, passive and early-close threat ledgers contain 18, 10 and 18 wave 3 admissions respectively, all within 0.8 m of the assigned door x. Door selection alternates ahead and behind when available. The corgi's exit follow speed now matches the walking column when nearby, avoiding a misleadingly fast companion pulling away from Marcus.

Early-close still flags `step/retreat` and `phase/retreat` for over 30% unreachable for more than 20 seconds. The latest evidence at tick 11532 contains four unreachable infected, including converted shelter residents 41, 21 and 29 far behind the courier. Removing named survivors from the world would require separate design work; the current cleanup preserves them. `PARTIAL_LEVEL_SELECTION` is expected for the L6-only audit.

Changes: `src/sim/missions/LevelSixSubway.ts` (door placement, source selection and cleanup), `src/sim/npc/Companion.ts` (exit pace). Earlier marker, checkpoint and loadout changes remain in the preceding commits.

High then low `qa:accept -- --level L6 --skip-browser` each reported zero fresh failing rows, with 14 and 12 incomplete rows respectively. Typecheck and lint passed; focused mission and progression tests passed 12/12. Threat audit failed with the two flags above. Generated fix51 receipts were left uncommitted as instructed.
