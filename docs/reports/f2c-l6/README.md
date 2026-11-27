# L6 sealed resident retirement

Turned shelter residents sealed behind a closed gate could remain unreachable for the rest of the retreat. Retire their living infected slot only when behind the courier and off screen, retaining a hidden roster snapshot so mission references remain valid. Corpses are excluded from retirement. The narrower closed-gate condition preserves ordinary retreat pressure without changing its placement, counts or infected stats.

| Measure | Before, low / high | After, low / high |
|---|---|---|
| L6-07 retreat damage | 55 / 55 HP; unrestricted retirement experiment 20 / 20 HP | 55 / 55 HP; 15.09 combined windups/min; peak 11 infected |
| L6-10 marker fixture | 0 / 0 failed branches of 12 | 0 / 0 failed branches of 12, no trajectory offenders |
| L6-13 unarmed maneuver | complete in 632.02 / 632.02 s, 20 deaths | complete in 632.02 / 632.02 s, 20 deaths, fists only |
| L6 threat audit | 2 early-close reachability flags | 0 L6 flags; `PARTIAL_LEVEL_SELECTION` only |

The audit recorded 18 skilled, 8 passive and 18 early-close wave 3 admissions, each within 0.8 m in x of its assigned service door. High and low acceptance each reported zero fresh failing rows, with 14 and 12 incomplete rows respectively; both commands returned exit 2 because of incomplete coverage. Typecheck, lint, and the focused mission and progression tests (12/12) passed. No browser visual review was requested in this CPU pass.

Changed `src/sim/missions/LevelSixSubway.ts`. No evaluator, criteria, or fix51 receipt was committed. Generated acceptance receipts remain in the worktree as instructed.
