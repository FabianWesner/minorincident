# r41-l4chase: the L4 north street can no longer be sprinted past

Finding (r38-vqa P2, verbatim): "L4 north street can be outrun. The new Alpha and heavy groups do engage and chase her to the cellar door, but sprinting gets her from the plaza exit to the cellar in 18 s." Level design only: zombies unchanged, corpses never removed.

## Root cause (measured with a sprinting bot, before)
1. Groups 18 and 19 (Harbor Street) could not appear before a fast courier had passed them: authored groups only emerged once the courier was on the street (`onStreets`) and 24 m or more from the group home. A sprinter leaving the plaza is within 24 m of group 18 the moment she is on the street. Before: group 18 never spawned in either tier, only the Alpha group (index 19) at the far end did.
2. Low tier (cap 80): the war fills the cap, `retireIdleFor` found no "idle" body (the whole war population is in `emergedIds`/`collapseIds` or chasing), so 3 of 4 groups never emerged in low (1 attack on the whole run).

## Change
- `src/data/l4.ts`: new authored heavy group at index 21, (-74, -40.4), size 4 (low 2), kind `heavy`: a held choke in the street directly in front of the cellar approach (door (-79.3, -45.3)), behind the existing Alpha group at (-66, -40.2). Together with groups 18 and 19 the north street now has three consecutive fights, and the sprinter ends the run in a choke she has to fight or run into.
- `src/sim/missions/LevelFourWar.ts` `emergeCollapse`: authored encounters (`q.roster`) no longer wait for the courier to leave the plaza; they emerge out of view from the start of the collapse (still unseen, 24 m or more away, ahead of her on the route). Standing at their homes they engage by sight as before.
- `retireIdleFor`: only Alphas and pending authored bodies are protected from the cap-making retire; war bodies no longer are. Preference order is unchanged (far idle first), then, if none, the farthest unseen body 30 m or more away that is not attacking/biting. Never an Alpha, never a corpse (alive bodies only, out of view).
- No zombie stat, speed or AI change.

## Design call
A fast courier cannot be intercepted by chasers (same speed), so the fix is bodies ahead of her that exist before she arrives: groups pre-spawned along the street and a final choke at the cellar. The run stays possible (fight through or take hits), but not free. Metro Road group (20) is on the marker's east loop and unchanged.

## Verification (native sim, `tools/qa/r37-l4north-probe.ts --sprint`)
Sprint bot: from the collapse it walks the north street waypoints straight to the cellar door, never attacking (it still has to path around bodies). "attacks" = infected attacks aimed at her from entering the street until the cellar phase; "landed" = those with positive damage. Data: `sprint-before.json`, `sprint-after2.json`, `probe-after.json`.

| Tier | Before: attacks / landed | After: attacks / landed | Time street -> cellar before / after |
|---|---|---|---|
| high | 4 / n.m. (hp -17) | 9 / 3 (60 dmg, hp -16 after armour) | 16.2 s / 17.0 s |
| low | 1 / n.m. | 8 / 6 (68 dmg) | 16.9 s / 17.3 s |

(Landed was not recorded in the before run; hits there were measured by HP loss: 2 high, 0 low.) The time is not the target (zombies and speed are unchanged); engagement is: target of 3 or more attacks landed met in both tiers. The normal complete bot still finishes L4 in both tiers (`probe-after.json`: outcome complete; peak alive 84 high / 61 low, cap 120 / 80).

Gates:
- `threat-audit --levels L4`: flags are the same kinds as the baseline: breach-west first attack >20 s, one breach with fewer than three cohort members (breach-north now, breach-south in r37), L4-06 first breach and sustained horde (hold numbers unchanged: firstAttack 9.9 s, peak alive 62).
- war-waves invariant (nightly, remote): 2 passed. `npm test` (remote): 27 files, 106 passed, 1 skipped.

## Browser QA needed
- level:L4 line-break, setup killAll + teleport (-19,-22) as in r37/r38 (logged); high and low, zoom 1 and 1.5, WebGL and WebGPU: run Harbor Street west at full speed with keys. Check: the three groups (x -48, -66 Alpha, -74) are standing in the street and visible as a fight, not popping in view (unseen emergence), the choke at x -74 is readable (space to move, no body stuck in the wall), the cellar prompt still reachable.
- Tick/position to check: collapse start + ~20 s (courier at x about -35): groups 18, 19, 21 already standing; courier at x -70: choke engaged.
- Perf with 9 to 13 bodies including heavies at the crossing (not measured; no perf run in lanes).
- Low tier: pop-in of replaced war bodies must not be visible (retired only when off screen).
