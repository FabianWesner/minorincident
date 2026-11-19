# s191b — L6 survivor firepower

## Current result

The matched HIGH real-input driver (seed 1, zoom 1, Simple) completed both routes without skips or assists: player deaths were **6 before → 4 after**, a one-third reduction. The baseline and candidate took 276 and 264 simulated seconds respectively. Each run emitted one P2 no-progress warning during the timed shelter opening. This is one automated physical run per version, not evidence of human play or of the player attack-rate floor. [Before](high-physical-before.json) · [after](high-physical-after.json).

A separate HIGH physical run with the read-only acceptance ledger enabled also completed with four deaths. During the retreat objective it recorded 154 player-targeted windups over 12,121 ticks (45.74/min) and 135 follower-targeted windups (40.10/min), including checkpoint retries. The run establishes the rate for this one physical driver route; the native complete probe still fails the relevant acceptance/threat conditions. [Ledger summary](high-physical-ledger-summary.json).

**Superseded balance figures below:** inspection found the follower update skipped ally combat during retreat. Those earlier runs did not exercise the added guns. The current worktree assigns real guns at shelter setup and routes armed followers through the existing ally combat update while their column movement continues. The HIGH seed 1 probe saves 29/29 but records only 2.85 player attacks/min, 3.79 follower attacks/min and zero player HP lost during retreat; L6-05 also fails. The player attack and L6-07 damage targets remain unmet. Typecheck and lint pass. Full acceptance, threat, unit and capture gates remain open.

After clearing stationary post/hold orders when the column retreats, a fresh HIGH seed 1 probe saves 28/29, records 5.02 player attacks/min and 10.05 follower attacks/min, and loses 20 HP during retreat. L6-05 and L6-07 damage still fail. The focused L6 threat audit no longer flags follower pace; its four remaining gameplay flags are the two breach first-attack limits, missing kiting sample and skilled damage below 30 HP. This is a diagnostic partial-level run, not a full zero-flag audit.

With those retreat orders, directing three quarters of the pressure cohort toward the player reduced the HIGH seed 1 player rate to 0.46/min and retreat damage to zero. Separately, reducing added guns to one shot per three seconds and 20% pistol near hit chance produced 3.77 player attacks/min and 10 HP damage. Both experiments were reverted; neither met the attack or damage targets.

With the corrected retreat orders and real guns active from shelter setup, assigning new guns to even roster positions yielded 0.45 player attacks/min and 25 HP retreat damage; assigning odd positions yielded 0.93/min and zero damage. Both retained passing observed follower pace and failed L6-05 and L6-07 damage. The original allocation was restored.

The same HIGH seed 1 acceptance probe was rerun against the unchanged pre-fix mission and outbreak code: player attack starts were 9.57/min, follower attack starts 11.00/min, retreat damage 40 HP, and nine of 29 survivors were lost. Thus the 11/min player-only floor is also below target in this matched baseline; the armed candidate reduces it further to 2.85/min. The baseline probe completed the route and passed the existing evaluator's combined-rate clause, which does not establish the separate player-only floor.

The matched observer identifies the pressure gap: the baseline had eight living infected at retreat start, versus one in the armed candidate. The first player-targeted retreat windup occurred after 1.15 seconds before and 83.92 seconds after. The observer saw 71 versus 66 distinct infected during retreat, and bounded-path reachability remained 100% in both. This points to encounter timing and combat clearance, not an observed navigation blockage; it does not by itself identify every cause of the long gap.

Matched `l6-pressure.ts` HIGH complete runs on seeds 1–3 now show survivor losses **9/8/8 → 0/1/0** (25 → 1 total); player deaths were zero throughout. The party-targeted post-first-closure attack rates were **23.61/15.47/20.45 → 11.84/15.73/12.74 per minute**. These combine player and follower targets and cannot establish the separate player-only floor. Authored counts, caps and cadence are unchanged, but actual wave-3 admissions differed for seed 3 (52 before, 44 after) as the runs evolved; seeds 1 and 2 admitted 40 in each version. Opening wave admissions were 8 and 10 and hatch wave admissions 12 in all six runs.

With real guns active from the shelter, reducing civilian accuracy and cadence to 20% near hit chance and one shot per three seconds yielded 2.32 player attacks/min, 6.03 follower attacks/min, 35 HP lost and four survivors lost; L6-05 still had no player windups. Sending the pressure arrivals toward the player yielded 2.33/min and 25 HP lost. Both experiments were reverted.

With real guns active, assigning them to the latter half of the roster yielded 1.44 player attacks/min, 1.92 follower attacks/min, 25 HP damage and three losses. Alternating roster positions yielded 2.23 player attacks/min, 10.24 follower attacks/min, zero HP damage and three losses. Both had zero player windups in the opening. The prior allocation was restored.

A read-only `ally.attack` event ledger on the current HIGH seed 1 complete run confirms actual firing: during the first breach, 49 pistol shots (18 hits) and four shotgun shots (three hits); during retreat, 154 pistol shots (59 hits) and 23 shotgun shots (nine hits). This establishes that the current candidate changes combat throughout the level, including the opening. The run saved 29/29; it does not resolve the missing player-pressure target.

Further HIGH seed 1 probes with real guns active: reducing both added weapon ranges to 5 m resulted in zero player attacks/min, zero retreat damage and a follower pace failure; reducing pistol accuracy to 5% and shotgun accuracy to 20% near range resulted in 1.39 player attacks/min and zero retreat damage. Both candidates were reverted.

The existing L6 perception already biases the player by six metres when selecting visible targets. Changing the new civilian allies from held posts to free posts produced identical HIGH seed 1 results (2.85 player attacks/min, zero retreat damage, zero survivor losses); that experiment was reverted. The post flag is therefore not the cause of the measured pressure change.

The allocation now counts firearms carried from L5 and preserves their ally state instead of replacing it. The actual L5 completion handover probe passed at both qualities: the carried rifle remained with its owner, with 14 of 28 survivors armed on LOW and 15 of 29 on HIGH, including one shotgun at each quality. Shelter identity, health and routine checks passed; seated and resting guns remain stored in the renderer. Typecheck and lint passed after this change. The player-pressure and full acceptance gates remain unresolved.

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
- Focused L6 threat audit on the current handover-aware source — FAIL: both early-close breach waves lack a player attack within 20 seconds, the skilled route has less than 30 HP damage and no kiting sample, and follower 16 is below the pace ratio in two retreat windows (median 2.212 m/s versus group 2.356 m/s). The separate partial-level-selection flag reflects the diagnostic scope.
- Allowing the column's movement update during an ally's hit flinch did not change those six L6 flags; the experiment was reverted.
- Full `npm run qa:threat` — completed in 498.1 seconds and failed with the same six L6 flags listed above; no other levels produced flags. Raw local receipt: `test-results/qa-threat/audit.json`.
- `qa:accept -- --level L6 --skip-browser --tier high` via the remote runner — FAIL: both native routes completed, eight fixture clauses had zero errors, and all seven checkpoints passed with an identical control. L6-05 and L6-07 failed on player windups and retreat damage, with 12 rows incomplete; [summary](high-accept-summary.json). The manifest-only remote job printed missing Git HEAD messages while producing the report, so it cannot establish review freshness. This single-tier, skip-browser run does not qualify the full acceptance gate. Pulled `fix51-verify` files were restored after inspection.
- LOW remote acceptance — queued for more than eight minutes and cancelled before admission; no LOW result was produced.
- Remote unit suite — the first admitted run exceeded the 240-second runner budget. An unchanged rerun completed in 212.5 seconds with 26 files passing and the combat gun cadence test exceeding its individual 30-second timeout. A later unchanged attempt passed that gun test but hit the 240-second suite limit; two further unchanged runs also hit the suite limit under elevated runner load. No full-suite pass has been obtained.
- HIGH zoom-1 firing capture — [reviewed](high-z1.jpg). Headless WebGL2 with Metal, HIGH, 1280×720, seed 1; a controlled scene teleported the column and courier to the tunnel and spawned eight runners. Fifteen roster members had guns and two had firing clips when the frame was captured. Muzzle flashes and the column are visible, though the crowd overlaps heavily; this staged frame does not prove an ordinary route or balance outcome. No browser errors.

The implementation is not committed. Git could not create the shared worktree index lock under the current filesystem permissions.
