# E24 · Level 6: Get Out (+ ending)

## Goal
The town has fallen (W5, night with fires → dawn). Revisit the places from L1–L5, now burning, blocked, abandoned, and overrun, and **escape the town**. Every system is in play: huge hordes, elites, vehicles, melee, firearms, explosives, hazards, short objectives, and fully upgraded abilities. The finale is a fire-engine drive through Main Street, abandoning it at the edge, and a final stand at the extraction helipad until the helicopter arrives at dawn. The final shot shows the disaster is not limited to this town. **"You survived the first day."**

## Depends on / Enables
E23, all systems / M3 exit, credits.

## Level design

| Segment | Revisited place (tier W5) | Beats | Target |
| --- | --- | --- | --- |
| 1. Home, burning | D-RES cul-de-sac (L1 start) | The same photo spot as L1 morning, now burning. Radio: an extraction chopper at the substation helipad at dawn. Grab a car. | 1:00 |
| 2. School | D-SCHOOL (L2) | The road is blocked by a burned bus; go on foot through the overrun schoolyard; Armored elites. Short objective: open the gate (generator). | 1:30 |
| 3. Mall | D-SHOP (L3 route A) | Cut through the supermarket and mall (interior combat, a Butcher elite in the food court). | 1:30 |
| 4. Fire station | D-CIVIC (L4 hub) | Find the **fire engine** (start it: 3 s interact); the survivor group is gone (story prop: radio left behind). | 0:45 |
| 5. Main Street run | D-MAIN (L1/L3) | **Driving set piece:** the fire engine rams through Main Street (diner on fire, gas station crater from L5), a migration in the streets, scripted collapses (a falling facade blocks the side streets and funnels the drive). The engine takes heavy damage and dies at the town edge. | 1:30 |
| 6. Final stand | D-EDGE helipad | Light 3 flares (interact), then survive **150 s** until the helicopter lands at dawn (lighting transitions from night to dawn over the timer). Waves include all archetypes with elites. | 2:30 |
| 7. Ending | Cutscene | Board the helicopter (with the corgi). Camera rise: the town burns below; on the horizon, smoke columns over other towns. Caption: **"You survived the first day."** Credits, then a stats summary of the campaign. | 0:40 |

Concurrent infected ≤ 200 (high). Checkpoints come at each segment.

## Bruno references
Reuse first, per the [reuse map](08-bruno-reuse-map.md). Read these before writing new code:
- [`Cycles/DayCycles.js`](../folio-2025/sources/Game/Cycles/DayCycles.js): night → dawn transition
- [`Physics/PhysicsVehicle.js`](../folio-2025/sources/Game/Physics/PhysicsVehicle.js): fire-engine tuning
- [`Tornado.js`](../folio-2025/sources/Game/Tornado.js): smoke column pattern
- [`View.js`](../folio-2025/sources/Game/View.js): ending camera

## Acceptance criteria

| ID | Criterion | Verification |
| --- | --- | --- |
| E24-AC01 | Mission graph completable (E12-AC07) | sim |
| E24-AC02 | The `complete` bot finishes on 20/20 seeds from `L6-default` | sim |
| E24-AC03 | The `newbie` bot finishes on ≥ 16/20 with a median of 7–10 min and median deaths ≤ 4 | sim |
| E24-AC04 | **Revisit fidelity:** for each revisited place there is a photo-spot pair (`lN-x` W0–W3 vs `l6-x` W5) from the same camera; the structural layout matches (road graph identical, building footprint IoU ≥ 0.8 in the top-down masks), and the decay differs (vision §7.5 "same place, fallen") | unit/vision |
| E24-AC05 | Fire-engine set piece: the engine cannot get stuck (a scripted collapse corridor + stuck recovery); the bot reaches the town edge in ≤ 120 s; the engine dies at the scripted point (HP floor until there) | sim |
| E24-AC06 | Final stand: the 150 s timer ±1 tick; the time of day interpolates from night to dawn (sun elevation increases monotonically); the helicopter lands at the end | sim/e2e |
| E24-AC07 | The ending plays, its captions match the text exactly, credits roll, and the campaign summary shows totals equal to the sum of the per-level results | e2e |
| E24-AC08 | Full-campaign test: the `complete` bot plays L1→L6 continuously, including the between-level progression choices (seeded), on 10 seeds in the sim-runner, with a total sim time of 30–60 min for the `newbie` profile | sim |
| E24-AC09 | Performance: `perf-l6-mainstreet` within budgets at both tiers | perf |
| E24-AC10 | Vision: `l6-home-burning` vs `l1-morning`, `l6-mainstreet-run`, `l6-helipad-dawn`, and `l6-ending-horizon` pass §7.1/§7.4/§7.5; the ending shot clearly shows multiple distant smoke columns | vision |
| E24-AC11 | Spectacle set pieces: the helipad has barricade slots (crates, sandbag pallets, the wrecked fire engine as a car barricade); the scripted **fuel-truck mega explosion** during the Main Street run plays its full chain (E27-AC06 detectors) and launches props; the helicopter searchlight is a promoted hero light with a beam and shadow | sim/visual |
