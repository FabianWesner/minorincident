# r31-l5rescue: L5 first-survivor rescue

PO 2026-11-10 (UAT, PROD batch 68): "L5 is still too hard. I cannot rescue my 1st survivor. Too many Zombies".
PO accepted L5 on batch 58 (2026-11-07, "It's still accepted."). Zombie stats stay identical everywhere; only level design changed here.

## Measurement

`tools/qa/l5-rescue-measure.ts <c|n> <seed>` (native sim, no browser). Window = from the first survivor found (always Mia, the stairwell above Harbor Street,
ring -30.4/-44.4, 49 m east of the cellar exit) until 90 s later. 6 runs per build (newbie + skilled/complete bot, seeds 1-3), means:

| | batch 58 (8b7a1fa) | main before this lane (a0957730) | after |
|---|---:|---:|---:|
| infected alive within 20 m of Mia (window mean) | 2.5 | 7.7 | 0 |
| within 40 m of Mia | 12.9 | 25.2 | 5-7 |
| within 20 m of the courier | 5.6 | 7.6 | 4-5 |
| within 40 m of the courier | 31.1 | 42.4 | 24-29 |
| infected engaging the courier per minute (whole run) | 22.4 | 21.8 | 10-19 |
| courier HP lost in window | 12 | 6 | 0-10 |
| courier deaths | 0 | 0 | 0 |
| Mia lost within the window | 0 / 6 | 3 / 6 | 0 / 6 |

(The b58 build shows a courier death at about 11 s at the cellar in 4 of 6 runs; the later cellar rework fixed that, so it is not part of the comparison.)

## What changed since b58, and why

First-parent bisect (182 merges, metric = infected near Mia during the window) points at `f691bf05` (merge of lane/p1-danger, 2026-11-09): "zombies identical
everywhere at PROD strength". It removed L5's own infected damage multiplier (1.25) and made L5's street infected the shared ordinary infected with full-damage
moving hits; the same batch gave the L5 pair at (14,28) a catalog heavy (butcher). Placement did not change (the same 10 infected stand within 20 m of Mia
at t=0 in both builds), but the shared infected now stay alive and reach the group far more often, and an L5 survivor dies on the first bite
(no wound model there, unlike L3 squad and L7 evacuees). Result: the first rescue works but Mia and Okafor are killed on the way to the church.
The PO rule keeps stats identical, so the compensation is level design.

## Change (level design only, L5 only)

- `src/data/l5.ts` `l5.firstRescue`: no street infected start within 28 m of Mia, 22 m of Okafor (second survivor), or within 9 m of the lines cellar -> Mia -> Okafor.
  `LevelFiveAftermath.spawnWanderers` skips those slots (`inFirstRescueQuiet`). The freed slots are not re-spent: road space at the 4 m spacing is used up, so the high-tier start
  population goes 150 -> 116 (the test accepts 65-100 % of the quota for both tiers). Everything east of the church and the Sam/Dale/Rosa/Metro stretches keep their placements.
- The authored Alpha that stood 11 m from Mia (-40,-37.4) moved to (4,-50); the authored pair at (-20,-37.6) moved to (18,-50), the single at (-46,-37.5) to (52,-37.4).
- No infected stat, AI or director change. L1/L2/L4 untouched.
- Test: `tests/qa/invariants/war-waves.test.ts` `assertL5Population` now asserts that no L5 infected stands in Mia's pocket or on the cellar -> Mia -> Okafor lines and that the start population is
  within 65-100 % of the quota (was exactly the quota). That test sits behind the L4 war-wave loop, which fails on main for unrelated L4 reasons (reached 45-51 of 54); the L5 half was verified
  separately in a scratch copy (passed).

## After numbers

See the table. Newbie bot, seeds 1-3: Mia rescued and still following 90 s later in 3/3, 0 deaths, HP loss 0-10. Complete bot: 3/3, 0 deaths. Full runs (tools/l5/bot.ts, 600 s cap): complete seed 1 5/5 rescued 0 deaths;
newbie seeds 1-3 complete in 318-333 s (b58 newbie seed 1: 311 s) with 0 deaths. Later losses still happen (newbie seed 3: Mia turns at 126 s, i.e. after the window; complete seed 2: Sam turns), so L5 keeps threat later.

## Threat audit (`tools/qa/threat-audit.ts --levels L5`)

Mac baseline on a0957730: only `KITING_*` flags (kiting below 2 attacks/min, 0 landed hits), skilled look-step 3.51 attacks/min with the first attack at 0.05 s.
After (final config, 116 infected): skilled complete still completes; `KITING_LANDED_HITS_BELOW_2:0.00` unchanged (KITING_BELOW_ATTACKS no longer fires). NEW flag: `L5/step/look:SKILLED_BELOW_ATTACKS_PER_MINUTE_3` (2.16 player + 0.43 group per min, first attack 105 s). Two earlier configs also raised `SLOW_FOLLOWER:28-30` on the passive run; the final one does not. Tuning the late placement (extra authored pairs) made the attack rate worse (0.85, 1.75), the metric is chaotic.
This is the direct conflict between L5-05 (>= 3 skilled attacks/min over the whole look step) and a quiet first rescue: the skilled bot's first attack is now at about 105 s.
Decision needed from the orchestrator/PO: relax L5-05 to measure from the second survivor, or add a scripted early (non-lethal) contact elsewhere.

## Browser QA needed

- L5 high and low, WebGL and WebGPU, zoom 1.5 and 1: walk cellar exit (-79,-44) -> Mia ring (-30,-44) -> church (-33.5,-2.7) with a fresh save; confirm the first minute is calm but not empty (distant infected visible), the Alpha is not in view of Mia, no pop-in of infected.
- Check the moved Alpha (4,-50) and the pair (18,-50) on the road to the Metro.
- Compare with PROD batch 68 at the same tick: infected count in view around Mia and around the church.
- Play the rescue by real input as a newbie: open Mia's door, walk her to the church, open the vestry.

## Files

tools/qa/l5-rescue-measure.ts, l5-rescue-start.ts, l5-rescue-loss.ts, l5-anchors.ts (measurement helpers); raw per-run JSON is in the lane's scratchpad only.

## Checks

tsc (both configs) and eslint on touched files clean. `npm run test:gate`: all pass except two tests in tests/tools/gate-tools.test.ts (browser pool WindowServer back-off, reviewFreshness STALE), unrelated to L5 sim data.
