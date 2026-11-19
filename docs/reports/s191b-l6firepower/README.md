# s191b — L6 survivor firepower

## Current result

**Superseded balance figures below:** inspection found the follower update skipped ally combat during retreat. Those earlier runs did not exercise the added guns. The current worktree assigns real guns at shelter setup and routes armed followers through the existing ally combat update while their column movement continues. The HIGH seed 1 probe saves 29/29 but records only 2.85 player attacks/min, 3.79 follower attacks/min and zero player HP lost during retreat; L6-05 also fails. The player attack and L6-07 damage targets remain unmet. Typecheck and lint pass. Full acceptance, threat, unit and capture gates remain open.

With real guns active from the shelter, reducing civilian accuracy and cadence to 20% near hit chance and one shot per three seconds yielded 2.32 player attacks/min, 6.03 follower attacks/min, 35 HP lost and four survivors lost; L6-05 still had no player windups. Sending the pressure arrivals toward the player yielded 2.33/min and 25 HP lost. Both experiments were reverted.

With real guns active, assigning them to the latter half of the roster yielded 1.44 player attacks/min, 1.92 follower attacks/min, 25 HP damage and three losses. Alternating roster positions yielded 2.23 player attacks/min, 10.24 follower attacks/min, zero HP damage and three losses. Both had zero player windups in the opening. The prior allocation was restored.

A read-only `ally.attack` event ledger on the current HIGH seed 1 complete run confirms actual firing: during the first breach, 49 pistol shots (18 hits) and four shotgun shots (three hits); during retreat, 154 pistol shots (59 hits) and 23 shotgun shots (nine hits). This establishes that the current candidate changes combat throughout the level, including the opening. The run saved 29/29; it does not resolve the missing player-pressure target.

Further HIGH seed 1 probes with real guns active: reducing both added weapon ranges to 5 m resulted in zero player attacks/min, zero retreat damage and a follower pace failure; reducing pistol accuracy to 5% and shotgun accuracy to 20% near range resulted in 1.39 player attacks/min and zero retreat damage. Both candidates were reverted.

The HIGH native complete run reduced survivor losses from 9/29 to 6/29 (33.3%) while keeping the authored L6 infected counts and entry cadence unchanged. Party-targeted infected attack starts remained above the 11/min floor: 23.61/min before and 15.38/min after, measured from first gate closure through exit. This is one seed (seed 1), using the same current-source `l6-pressure.ts` probe and bot policy for both runs.

| HIGH, seed 1 | Before | After |
|---|---:|---:|
| Survivors lost | 9/29 | 6/29 |
| Survivors rescued | 20/29 | 23/29 |
| Player deaths | 0 | 0 |
| Party-targeted infected attack starts during retreat | 39 | 25 |
| Retreat duration | 99.10 s | 97.52 s |
| Attack starts per minute | 23.61 | 15.38 |
| Spawn admissions by authored wave (1/2/3/4) | 8/10/40/12 | 8/10/40/12 |

The attack-start measure includes the player and the following survivors, matching the L6 pressure probe's party-threat window. The HIGH acceptance observer records 11 player-targeted starts over 122.75 seconds (5.38/min), plus 22 follower-targeted starts (10.75/min). The requested player-only floor is unmet.

Additional HIGH seed 1 experiments directed half, three quarters, and all of the existing pressure arrivals toward the player. Player attack rates were respectively 4.92, 7.31, and 9.49/min; survivor losses were 7, 6, and 8. All remain below 11/min, so the original targeting was restored.

Spreading armed survivors over alternating roster positions was also measured. Even positions produced 7.80 player attacks/min and seven losses; with three quarters of pressure arrivals aimed at the player, 7.20/min and seven losses. Odd positions produced 4.32/min and six losses, but only 10 HP retreat damage (below the L6-07 minimum). The original allocation was restored.

## Implementation and checks

The 29-person roster arms 15 people: the existing officer with a pistol, one shotgun carrier, and 13 pistol carriers. Weapon visuals follow each ally's weapon type. Added allies are armed visibly in the shelter and become active shooters when the retreat starts. This timing preserves the L6-05 breach combat window while allowing the armed column to fire during the retreat.

The current-source native evaluator reports no failing L6 clauses for HIGH/LOW × complete/stationary. In HIGH complete, L6-05 is 4.35 player/group windups per minute, L6-07 is 16.13 player/group windups per minute, retreat damage is 45 HP, and L6-08 follower pace passes. All L6 authored wave admission counts match before and after.

- `npm run typecheck` — PASS.
- `npm run lint` — PASS.
- Focused L6 threat audit — 0 L6 threat flags; audit exits nonzero for the intentional partial-level-selection flag, and its passive route reports tick-budget rather than a completed result.
- Full `npm run qa:threat` — did not finish within its 600-second batch/reservation limit; no final flag count was produced.
- `qa:accept -- --level L6 --skip-browser` via the remote runner — runner unavailable (no healthy runner). Direct HIGH/LOW complete/stationary probes evaluated with zero failing L6 clauses. The full acceptance report writer also hits the repository's missing historical G-28 criterion before producing a report.
- Remote unit suite — a subsequent attempt remained queued for over eight minutes and was cancelled before admission; no test result was produced.
- HIGH zoom-1 firing capture — [reviewed](high-z1.jpg). Headless WebGL2 with Metal, HIGH, 1280×720, seed 1; a controlled scene teleported the column and courier to the tunnel and spawned eight runners. Fifteen roster members had guns and two had firing clips when the frame was captured. Muzzle flashes and the column are visible, though the crowd overlaps heavily; this staged frame does not prove an ordinary route or balance outcome. No browser errors.

The implementation is not committed. Git could not create the shared worktree index lock under the current filesystem permissions.
